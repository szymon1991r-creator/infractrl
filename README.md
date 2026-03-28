# InfraCtrl Orders

Order management system for industrial materials. Four React frontends backed by a single Python FastAPI service with SQLite storage and Prometheus/Loki monitoring.

---

## Services

| Port | Container | Audience | Language |
|------|-----------|----------|----------|
| 3001 | client-a | Client A | English |
| 3002 | client-b | Client B | English |
| 3003 | admin | Administrator | Polish |
| 3004 | production | Production floor | Polish |
| 8000 | api | — | REST / Swagger |
| 3000 | grafana | DevOps | — |
| 9090 | prometheus | DevOps | — |

---

## Requirements

- Docker Desktop ≥ 24 with Compose v2
- AWS CLI, Terraform ≥ 1.7, Ansible ≥ 2.15 *(for cloud deploy only)*

---

## Local setup

```bash
git clone https://github.com/your-org/infractrl.git
cd infractrl

cp config.env .env
# Edit .env — set GRAFANA_PASSWORD at minimum

docker-compose up -d --build
```

All services start on the ports listed above. API documentation is available at http://localhost:8000/docs.

---

## Project structure

```
infractrl/
├── .env                          # active environment (never commit)
├── config.env                    # template — copy to .env
├── docker-compose.yml
├── deploy.sh                     # automated AWS deploy
├── apps/
│   ├── client-a/                 # Client A portal (dark, English)
│   ├── client-b/                 # Client B portal (violet, English)
│   ├── admin/                    # Admin panel (Polish)
│   └── production/               # Production floor panel (Polish)
├── backend/
│   ├── src/main.py               # FastAPI + SQLite + Prometheus metrics
│   ├── Dockerfile
│   └── requirements.txt
├── monitoring/
│   ├── prometheus.yml
│   ├── loki.yml
│   ├── promtail.yml
│   └── grafana/provisioning/
├── terraform/
│   ├── terraform-main.tf         # EC2 + Security Groups
│   └── ansible/
└── scripts/
    └── setup-autostop.sh         # EventBridge EC2 auto-stop/start
```

---

## Order flow

```
Client A / B  →  places order  →  API (status: nowe)
                                      ↓
                               Administrator
                               ├─ confirms        → potwierdzone
                               ├─ sends to floor  → produkcja
                               └─ marks shipped   → wyslane
                                      ↓
                               Production floor
                               ├─ sets material status (OK / brak)
                               ├─ sets production state
                               └─ adds internal note (admin-only)
```

---

## Order statuses

| Status | Set by | Meaning |
|--------|--------|---------|
| nowe | Client | Order placed |
| potwierdzone | Admin | Confirmed |
| produkcja | Admin | In production |
| gotowe | Production | Ready |
| wyslane | Admin | Shipped |
| awaria | Admin | Issue |

---

## REST API

Full Swagger UI at `/docs`. Summary:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /orders | List orders (filters: `status`, `client_id`) |
| POST | /orders | Create order |
| PATCH | /orders/{id} | Update status / notes |
| DELETE | /orders/{id} | Delete order |
| GET | /metrics | Prometheus metrics |

```bash
# List all orders for Client A
curl http://localhost:8000/orders?client_id=client-a

# Create an order
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{"id":"ORD-001","product":"Basalt 0-31mm","tons":50,"clientId":"client-a"}'

# Confirm an order
curl -X PATCH http://localhost:8000/orders/ORD-001 \
  -H "Content-Type: application/json" \
  -d '{"status":"potwierdzone","adminNote":"Scheduled for next week."}'
```

---

## Database

SQLite, stored in Docker volume `api-data`. Schema is created automatically on first start.

```bash
# Backup
docker cp infractrl-api:/data/orders.db ./backup-$(date +%Y%m%d).db

# Restore
docker cp ./backup-20260101.db infractrl-api:/data/orders.db
docker-compose restart api

# Interactive shell
docker exec -it infractrl-api sqlite3 /data/orders.db

# Reset (destroys all data)
docker-compose down -v && docker-compose up -d --build
```

---

## Monitoring

Grafana at http://localhost:3000 — login `admin`, password from `GRAFANA_PASSWORD` in `.env`.

**Prometheus metrics:**

| Metric | Labels |
|--------|--------|
| `api_requests_total` | method, endpoint, status |
| `api_request_duration_seconds` | endpoint |
| `orders_created_total` | client_id |
| `order_status_changes_total` | from_status, to_status |
| `orders_deleted_total` | — |

**Loki log queries:**

```logql
{service="api"}                   # all API logs
{service="api"} |= "ERROR"        # errors only
{service="api"} |= "order_created"
{service="api"} |= "status_changed"
```

---

## Configuration

All configuration is controlled via `.env`. Key variables:

| Variable | Description |
|----------|-------------|
| `API_URL_CLIENTS` | Backend URL baked into client builds. `http://localhost:8000` locally, `http://<EC2-IP>:8000` on AWS. |
| `GRAFANA_PASSWORD` | Grafana admin password. Set once in `.env` — this is the only place to change it. |
| `CLIENT_A_COLOR` / `CLIENT_B_COLOR` | Accent colour for each portal (requires rebuild). |
| `ALLOWED_IP_*` | IP allowlist per service (empty = public). Format: `1.2.3.4/32`. |
| `AUTOSTOP_*` | EC2 auto-stop schedule (Warsaw timezone, weekdays). |

---

## AWS deploy

### Prerequisites

```bash
# Create SSH key pair
aws ec2 create-key-pair \
  --key-name infractrl-key \
  --query 'KeyMaterial' --output text > ~/.ssh/infractrl-key.pem
chmod 400 ~/.ssh/infractrl-key.pem
```

### Deploy

```bash
cp config.env .env
# Set GRAFANA_PASSWORD, ALLOWED_SSH_IP in .env

chmod +x deploy.sh
./deploy.sh
```

The script runs `terraform apply` to provision EC2 and Security Groups, then `ansible-playbook` to install Docker, copy files, and start all services.

After deploy, update `API_URL_CLIENTS` in `.env` with the EC2 public IP and rebuild:

```bash
docker-compose up -d --build client-a client-b
```

### Estimated costs (eu-central-1, t3.medium)

| Scenario | $/month |
|----------|---------|
| 8 h/day × 5 days | ~$6 |
| 24/7 On-Demand | ~$30 |
| 24/7 Reserved 1yr | ~$18 |

```bash
# Stop instance (data preserved)
aws ec2 stop-instances --region eu-central-1 \
  --instance-ids $(cd terraform && terraform output -raw instance_id)

# Destroy everything
cd terraform && terraform destroy
```

---

## Common commands

```bash
docker-compose ps
docker-compose logs -f api
docker-compose restart api
docker-compose up -d --build client-a

docker exec -it infractrl-api sqlite3 /data/orders.db "SELECT * FROM orders LIMIT 5;"
docker stats
```

---

## Troubleshooting

**Failed to fetch / API unreachable**
```bash
curl http://localhost:8000/health
docker-compose logs api --tail=30
```

**Port already in use**
Change the relevant `PORT_*` variable in `.env` and restart the affected service.

**Terraform: permission denied on provider binary**
```bash
chmod -R +x terraform/.terraform/providers/
```

**Security Group already exists error during deploy**
```bash
SG_ID=$(aws ec2 describe-security-groups   --region eu-central-1   --filters "Name=group-name,Values=infractrl-sg"   --query "SecurityGroups[0].GroupId" --output text)
cd terraform && terraform import aws_security_group.infractrl $SG_ID && cd ..
./deploy.sh
```

**API health check timeout during deploy**
Build takes 5-10 minutes on first run. Ansible waits up to 10 minutes. If it still times out:
```bash
ssh -i ~/.ssh/infractrl-key.pem ec2-user@<SERVER-IP>
tail -f /tmp/infractrl-build.log
```
Once the build finishes the app starts automatically on every reboot via systemd.
