from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import sqlite3, os, logging, time, json

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "time":  datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "msg":   record.getMessage(),
        })

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
log = logging.getLogger("infractrl")

REQUESTS      = Counter("api_requests_total",            "HTTP requests",         ["method", "endpoint", "status"])
LATENCY       = Histogram("api_request_duration_seconds", "Response time",        ["endpoint"])
ORDERS_TOTAL  = Counter("orders_created_total",           "Orders created",        ["client_id"])
STATUS_CHANGE = Counter("order_status_changes_total",     "Status changes",        ["from_status", "to_status"])
ORDERS_DELETED= Counter("orders_deleted_total",           "Orders deleted",        [])

DB_PATH = os.getenv("DB_PATH", "/data/orders.db")

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id              TEXT PRIMARY KEY,
                product         TEXT NOT NULL,
                tons            REAL NOT NULL,
                status          TEXT DEFAULT 'nowe',
                client_id       TEXT DEFAULT 'client-a',
                prod_status     TEXT DEFAULT 'oczekuje',
                material_status TEXT DEFAULT 'pending',
                prod_note       TEXT DEFAULT '',
                deadline        TEXT DEFAULT '',
                admin_note      TEXT DEFAULT '',
                note            TEXT DEFAULT '',
                created_at      TEXT,
                updated_at      TEXT
            )
        """)
        conn.commit()
    log.info("database initialized path=" + DB_PATH)


class OrderIn(BaseModel):
    id:             str
    product:        str
    tons:           float
    status:         str = "nowe"
    clientId:       str = "client-a"
    prodStatus:     str = "oczekuje"
    materialStatus: str = "pending"
    prodNote:       str = ""
    deadline:       str = ""
    adminNote:      str = ""
    note:           str = ""

class OrderPatch(BaseModel):
    status:         Optional[str] = None
    prodStatus:     Optional[str] = None
    materialStatus: Optional[str] = None
    prodNote:       Optional[str] = None
    deadline:       Optional[str] = None
    adminNote:      Optional[str] = None

def row_to_dict(row):
    return {
        "id":             row["id"],
        "product":        row["product"],
        "tons":           row["tons"],
        "status":         row["status"],
        "clientId":       row["client_id"],
        "prodStatus":     row["prod_status"],
        "materialStatus": row["material_status"],
        "prodNote":       row["prod_note"],
        "deadline":       row["deadline"],
        "adminNote":      row["admin_note"],
        "note":           row["note"],
        "createdAt":      row["created_at"],
        "updatedAt":      row["updated_at"],
    }


app = FastAPI(title="InfraCtrl Orders API", version="4.0.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.middleware("http")
async def track(request, call_next):
    start = time.time()
    response = await call_next(request)
    dur = time.time() - start
    ep = request.url.path
    REQUESTS.labels(request.method, ep, response.status_code).inc()
    LATENCY.labels(ep).observe(dur)
    log.info(f"method={request.method} path={ep} status={response.status_code} duration={dur:.3f}s")
    return response

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/orders", response_model=List[dict])
def list_orders(status: str = None, client_id: str = None):
    with get_db() as conn:
        q = "SELECT * FROM orders WHERE 1=1"
        params = []
        if status:    q += " AND status=?";    params.append(status)
        if client_id: q += " AND client_id=?"; params.append(client_id)
        q += " ORDER BY created_at DESC"
        rows = conn.execute(q, params).fetchall()
    return [row_to_dict(r) for r in rows]

@app.post("/orders", status_code=201)
def create_order(order: OrderIn):
    now = datetime.utcnow().isoformat()
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (order.id, order.product, order.tons, order.status,
                  order.clientId, order.prodStatus, order.materialStatus,
                  order.prodNote, order.deadline, order.adminNote, order.note,
                  now, now))
            conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Order with this ID already exists")
    ORDERS_TOTAL.labels(order.clientId).inc()
    log.info(f"order_created id={order.id} client={order.clientId} tons={order.tons}")
    return {"id": order.id, "created": True}

@app.patch("/orders/{order_id}")
def update_order(order_id: str, patch: OrderPatch):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Order not found")
        old_status = row["status"]
        fields, vals = [], []
        for attr, col in [
            ("status",         "status"),
            ("prodStatus",     "prod_status"),
            ("materialStatus", "material_status"),
            ("prodNote",       "prod_note"),
            ("deadline",       "deadline"),
            ("adminNote",      "admin_note"),
        ]:
            v = getattr(patch, attr)
            if v is not None:
                fields.append(f"{col}=?")
                vals.append(v)
        if not fields:
            return row_to_dict(row)
        fields.append("updated_at=?")
        vals.append(datetime.utcnow().isoformat())
        vals.append(order_id)
        conn.execute(f"UPDATE orders SET {','.join(fields)} WHERE id=?", vals)
        conn.commit()
        if patch.status and patch.status != old_status:
            STATUS_CHANGE.labels(old_status, patch.status).inc()
            log.info(f"status_changed id={order_id} from={old_status} to={patch.status}")
        updated = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
    return row_to_dict(updated)

@app.delete("/orders/{order_id}")
def delete_order(order_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM orders WHERE id=?", (order_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Order not found")
        conn.execute("DELETE FROM orders WHERE id=?", (order_id,))
        conn.commit()
    ORDERS_DELETED.inc()
    log.info(f"order_deleted id={order_id}")
    return {"deleted": True}
