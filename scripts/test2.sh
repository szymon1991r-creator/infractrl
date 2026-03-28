SERVER_IP="63.182.212.239"
KEY_FILE="~/.ssh/infractrl-key.pem"

# Zsynchronizuj wszystkie pliki (z katalogu infractrl/)
rsync -avz -e "ssh -i $KEY_FILE" \
  --exclude=.git \
  --exclude=.gitignore \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=build \
  --exclude=.terraform \
  --exclude=*.tfstate \
  --exclude=*.tfstate.backup \
  --exclude=.terraform.lock.hcl \
  --exclude=*.pem \
  --exclude=.env \
  --exclude=ansible/inventory.ini \
  ./ ec2-user@$SERVER_IP:/opt/infractrl/

echo "✓ Pliki zsynchronizowane"
