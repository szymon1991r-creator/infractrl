#!/bin/bash
# ==============================================================
# cleanup.sh — Pełne czyszczenie przed ponownym deploy.sh
# Usuwa: infrastrukturę AWS (Terraform), lokalny stan Terraform,
#        inventory Ansible oraz tymczasowe pliki build.
#
# Użycie:
#   bash cleanup.sh           # usuwa AWS + lokalny stan
#   bash cleanup.sh --local   # tylko lokalny stan (bez AWS destroy)
# ==============================================================
set -e

GR='\033[0;32m'; BL='\033[0;34m'; YL='\033[0;33m'; RD='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GR}  ✓ $1${NC}"; }
inf()  { echo -e "${BL}  → $1${NC}"; }
warn() { echo -e "${YL}  ⚠ $1${NC}"; }
err()  { echo -e "${RD}  ✕ $1${NC}"; exit 1; }
step() { echo -e "\n${BL}▶ $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOCAL_ONLY=false
[[ "${1}" == "--local" ]] && LOCAL_ONLY=true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       InfraCtrl — Cleanup / Reset        ║"
echo "╚══════════════════════════════════════════╝"

# ── Krok 1: Terraform destroy (AWS) ───────────────────────────
if [ "$LOCAL_ONLY" = false ]; then
  step "[1/3] Terraform destroy — usuwanie zasobów AWS"

  if [ ! -f terraform/terraform.tfvars ]; then
    warn "Brak terraform/terraform.tfvars — pomijam destroy (brak infrastruktury do usunięcia)"
  elif [ ! -d terraform/.terraform ]; then
    warn "Terraform nie był inicjalizowany — inicjalizuję przed destroy..."
    cd terraform
    terraform init -input=false -upgrade 2>/dev/null
    cd ..
  fi

  if [ -f terraform/terraform.tfvars ] && [ -d terraform/.terraform ]; then
    cd terraform

    # Sprawdź czy jest coś do zniszczenia
    RESOURCE_COUNT=$(terraform state list 2>/dev/null | wc -l || echo 0)

    if [ "$RESOURCE_COUNT" -gt 0 ]; then
      inf "Znaleziono $RESOURCE_COUNT zasobów do usunięcia..."
      terraform destroy -auto-approve -input=false
      ok "Infrastruktura AWS usunięta"
    else
      warn "Brak zasobów w stanie Terraform — pomijam destroy"
    fi

    cd ..
  fi
else
  step "[1/3] AWS destroy — POMINIĘTO (--local)"
  warn "Jeśli instancja EC2 działa, zniszcz ją ręcznie:"
  echo "    cd terraform && terraform destroy"
fi

# ── Krok 2: Wyczyść lokalny stan Terraform ────────────────────
step "[2/3] Czyszczenie lokalnego stanu Terraform"

# Stan Terraform
for f in \
  terraform/terraform.tfstate \
  terraform/terraform.tfstate.backup \
  terraform.tfstate \
  terraform.tfstate.backup; do
  if [ -f "$f" ]; then
    rm -f "$f"
    ok "Usunięto: $f"
  fi
done

# Cache providerów (opcjonalnie — odkomentuj jeśli chcesz pełny reset)
# rm -rf terraform/.terraform
# rm -f  terraform/.terraform.lock.hcl
# warn "Usunięto cache providerów (.terraform/) — terraform init wymagany przed deploy"

# ── Krok 3: Wyczyść pliki generowane przez deploy.sh ─────────
step "[3/3] Czyszczenie plików generowanych przez deploy.sh"

# Inventory Ansible (generowane dynamicznie przez deploy.sh)
for inv in \
  ansible/inventory.ini \
  terraform/ansible/inventory.ini; do
  if [ -f "$inv" ]; then
    rm -f "$inv"
    ok "Usunięto: $inv"
  fi
done

# Przywróć domyślne tfvars (usuń wygenerowane przez deploy.sh)
# deploy.sh nadpisuje terraform.tfvars — przy ponownym deploy regeneruje go ze .env
if grep -q "^# GENERATED" terraform/terraform.tfvars 2>/dev/null; then
  rm -f terraform/terraform.tfvars
  ok "Usunięto wygenerowany terraform/terraform.tfvars"
fi

# Zresetuj API_URL_CLIENTS w .env do wartości lokalnej
if [ -f .env ]; then
  if grep -q "^API_URL_CLIENTS=http://[0-9]" .env; then
    sed -i 's|^API_URL_CLIENTS=.*|API_URL_CLIENTS=http://localhost:8000|' .env
    ok "Zresetowano API_URL_CLIENTS → http://localhost:8000"
  fi
fi

# ── Podsumowanie ──────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
if [ "$LOCAL_ONLY" = false ]; then
  echo -e "║         ${GR}CLEANUP COMPLETE${NC}                  ║"
else
  echo -e "║      ${YL}LOCAL CLEANUP COMPLETE${NC}               ║"
fi
echo "╚══════════════════════════════════════════╝"
echo ""
echo -e "  Możesz teraz uruchomić deploy od zera:"
echo -e "  ${GR}bash deploy.sh${NC}"
echo ""

if [ "$LOCAL_ONLY" = true ]; then
  echo -e "  ${YL}UWAGA:${NC} Użyłeś --local. Jeśli instancja EC2 nadal działa w AWS,"
  echo -e "  zniszcz ją ręcznie przed ponownym deploy, lub terraform"
  echo -e "  spróbuje użyć istniejących zasobów (może się nie udać):"
  echo -e "  ${RD}cd terraform && terraform destroy${NC}"
  echo ""
fi
