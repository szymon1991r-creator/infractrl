SERVER_IP="63.182.212.239"
KEY_FILE="~/.ssh/infractrl-key.pem"

# SSH na serwer
ssh -i "$KEY_FILE" ec2-user@$SERVER_IP

# Na serwerze, sprawdź:
# 1. User data log
tail -100 /var/log/cloud-init-output.log
tail -100 /var/log/cloud-init.log

# 2. Czy Docker jest zainstalowany?
which docker
docker --version

# 3. Czy dnf działa?
dnf --version
sudo dnf update -y

# 4. Jeśli nic nie pomaga, instaluj ręcznie:
sudo dnf update -y
sudo dnf install -y docker git curl
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
newgrp docker

# 5. Docker Compose
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose

# 6. Sprawdź czy działa
docker ps
docker-compose --version
