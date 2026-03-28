#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GR='\033[0;32m'; BL='\033[0;34m'; YL='\033[0;33m'; RD='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GR}  ✓ $1${NC}"; }
inf()  { echo -e "${BL}  → $1${NC}"; }
warn() { echo -e "${YL}  ⚠ $1${NC}"; }
err()  { echo -e "${RD}  ✕ $1${NC}"; exit 1; }
step() { echo -e "\n${BL}▶ $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      InfraCtrl Orders — AWS Deploy       ║"
echo "╚══════════════════════════════════════════╝"

# ── Wymagania ─────────────────────────────────────────────────
for cmd in aws terraform ansible-playbook ssh curl; do
  command -v $cmd &>/dev/null || err "Missing required tool: $cmd"
done
ok "All tools available"

# ── Wczytaj .env ──────────────────────────────────────────────
[ -f ".env" ] || err "Missing .env — copy config.env to .env and fill in your values"
set -a; source .env; set +a
ok "Environment loaded from .env"

[ -n "$GRAFANA_PASSWORD" ] || err "GRAFANA_PASSWORD is not set in .env"
[ -n "$AWS_KEY_NAME" ]     || err "AWS_KEY_NAME is not set in .env"
[ -n "$GHCR_OWNER" ]       || err "GHCR_OWNER is not set in .env"
[ -n "$GHCR_TOKEN" ]       || err "GHCR_TOKEN is not set in .env"

echo ""
echo -e "${BL}  Access restrictions (empty = public):${NC}"
echo -e "  Client A   :3001 → ${ALLOWED_IP_CLIENT_A:-0.0.0.0/0}"
echo -e "  Client B   :3002 → ${ALLOWED_IP_CLIENT_B:-0.0.0.0/0}"
echo -e "  Admin      :3003 → ${ALLOWED_IP_ADMIN:-0.0.0.0/0}"
echo -e "  Production :3004 → ${ALLOWED_IP_PRODUCTION:-0.0.0.0/0}"
echo -e "  Monitoring :3000 → ${ALLOWED_IP_MONITORING:-0.0.0.0/0}"
echo -e "  SSH        :22   → ${ALLOWED_SSH_IP:-0.0.0.0/0}"

KEY_FILE="${AWS_KEY_FILE:-$HOME/.ssh/${AWS_KEY_NAME}.pem}"
[ -f "$KEY_FILE" ] || err "SSH key not found: $KEY_FILE"
chmod 400 "$KEY_FILE"
ok "SSH key: $KEY_FILE"

# ── Sprawdź czy obrazy GHCR istnieją ─────────────────────────
step "[0/4] Checking GHCR images"

IMAGES=(
  "infractrl-api"
  "infractrl-client-a"
  "infractrl-client-b"
  "infractrl-admin"
  "infractrl-production"
)

MISSING=0
for img in "${IMAGES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${GHCR_OWNER}:${GHCR_TOKEN}" \
    "https://ghcr.io/v2/${GHCR_OWNER}/${img}/manifests/latest" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    ok "ghcr.io/${GHCR_OWNER}/${img}:latest"
  else
    warn "ghcr.io/${GHCR_OWNER}/${img}:latest — NOT FOUND (status: $STATUS)"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  err "$MISSING obraz(ów) nie znaleziono w GHCR. Wypchnij kod do gałęzi 'main' i poczekaj aż GitHub Actions skończy build."
fi
ok "All images available in GHCR"

# ── Krok 1: Terraform ─────────────────────────────────────────
step "[1/4] Terraform — provisioning AWS infrastructure"

AMI_OK=$(aws ec2 describe-images \
  --region "${AWS_REGION:-eu-west-1}" \
  --image-ids "${AWS_AMI_ID:-ami-0}" \
  --query 'Images[0].ImageId' --output text 2>/dev/null || echo "None")

if [ "$AMI_OK" = "None" ] || [ -z "$AMI_OK" ]; then
  warn "AMI ${AWS_AMI_ID} not found — searching for latest Amazon Linux 2023..."
  AWS_AMI_ID=$(aws ec2 describe-images \
    --region "${AWS_REGION:-eu-west-1}" \
    --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023*" "Name=architecture,Values=x86_64" \
    --query 'sort_by(Images,&CreationDate)[-1].ImageId' \
    --output text)
  ok "Found AMI: $AWS_AMI_ID"
fi

cat > terraform/terraform.tfvars << TFVARS
aws_region            = "${AWS_REGION:-eu-west-1}"
key_name              = "${AWS_KEY_NAME}"
instance_type         = "${AWS_INSTANCE_TYPE:-t3.small}"
ami_id                = "${AWS_AMI_ID}"
allowed_ssh_ip        = "${ALLOWED_SSH_IP:-0.0.0.0/0}"
allowed_ip_client_a   = "${ALLOWED_IP_CLIENT_A:-0.0.0.0/0}"
allowed_ip_client_b   = "${ALLOWED_IP_CLIENT_B:-0.0.0.0/0}"
allowed_ip_admin      = "${ALLOWED_IP_ADMIN:-0.0.0.0/0}"
allowed_ip_production = "${ALLOWED_IP_PRODUCTION:-0.0.0.0/0}"
allowed_ip_monitoring = "${ALLOWED_IP_MONITORING:-0.0.0.0/0}"
TFVARS

cd terraform
terraform init -input=false -upgrade 2>/dev/null
terraform apply -auto-approve -input=false

SERVER_IP=$(terraform output -raw server_ip 2>/dev/null)
[ -n "$SERVER_IP" ] || err "Could not get server IP from Terraform output"
INSTANCE_ID=$(terraform output -raw instance_id)
ok "EC2 ready: $SERVER_IP  (ID: $INSTANCE_ID)"
cd ..

if grep -q "^API_URL_CLIENTS=" .env; then
  sed -i "s|^API_URL_CLIENTS=.*|API_URL_CLIENTS=http://$SERVER_IP:8000|" .env
else
  echo "API_URL_CLIENTS=http://$SERVER_IP:8000" >> .env
fi
ok "API_URL_CLIENTS → http://$SERVER_IP:8000"

# ── Krok 2: Czekaj na SSH ─────────────────────────────────────
step "[2/4] Waiting for server SSH (up to 5 min)"

for i in $(seq 1 30); do
  if ssh -i "$KEY_FILE" \
       -o StrictHostKeyChecking=no \
       -o ConnectTimeout=8 \
       -o BatchMode=yes \
       "ec2-user@$SERVER_IP" "echo ok" &>/dev/null; then
    ok "SSH ready"; break
  fi
  [ $i -ge 30 ] && err "Server SSH not responding after 5 min"
  inf "Waiting... ($((i*10))s)"; sleep 10
done

# ── Krok 3: Ansible inventory ─────────────────────────────────
step "[3/4] Generating Ansible inventory"

cat > ansible/inventory.ini << INV
[infractrl]
${SERVER_IP} ansible_user=ec2-user ansible_ssh_private_key_file=${KEY_FILE} ansible_ssh_common_args='-o StrictHostKeyChecking=no'
INV
ok "ansible/inventory.ini generated"

# ── Krok 4: Ansible deploy ────────────────────────────────────
step "[4/4] Ansible — deploying application"

ANSIBLE_HOST_KEY_CHECKING=False \
  ansible-playbook -i ansible/inventory.ini ansible/playbook.yml \
  --extra-vars "ghcr_owner=${GHCR_OWNER} ghcr_token=${GHCR_TOKEN}"

# ── Auto-stop EC2 ─────────────────────────────────────────────
if [ "${AUTOSTOP_ENABLED}" = "true" ]; then
  echo ""
  inf "Configuring EC2 auto-stop schedule..."
  bash scripts/setup-autostop.sh "$INSTANCE_ID" \
    "${AWS_REGION:-eu-west-1}" \
    "${AUTOSTOP_STOP_HOUR:-18}" \
    "${AUTOSTOP_START_HOUR:-7}" \
    "${AUTOSTOP_TIMEZONE:-Europe/Warsaw}" 2>/dev/null && ok "Auto-stop configured" || warn "Auto-stop setup failed (non-critical)"
fi

# ── Podsumowanie ──────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo -e "║         ${GR}DEPLOY COMPLETE${NC}                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo -e "  ${BL}Client A:${NC}    http://${SERVER_IP}:${PORT_CLIENT_A:-3001}"
echo -e "  ${BL}Client B:${NC}    http://${SERVER_IP}:${PORT_CLIENT_B:-3002}"
echo -e "  ${BL}Admin:${NC}       http://${SERVER_IP}:${PORT_ADMIN:-3003}"
echo -e "  ${BL}Production:${NC}  http://${SERVER_IP}:${PORT_PRODUCTION:-3004}"
echo -e "  ${GR}Grafana:${NC}     http://${SERVER_IP}:${PORT_GRAFANA:-3000}  (admin / ${GRAFANA_PASSWORD})"
echo -e "  ${BL}API docs:${NC}    http://${SERVER_IP}:8000/docs"
echo ""
echo -e "  ${YL}SSH:${NC}"
echo -e "  ssh -i $KEY_FILE ec2-user@${SERVER_IP}"
echo ""
echo -e "  ${YL}Stop EC2 (data preserved):${NC}"
echo -e "  aws ec2 stop-instances --region ${AWS_REGION:-eu-west-1} --instance-ids ${INSTANCE_ID}"
echo ""
echo -e "  ${RD}Destroy everything:${NC}"
echo -e "  cd terraform && terraform destroy"
echo ""
