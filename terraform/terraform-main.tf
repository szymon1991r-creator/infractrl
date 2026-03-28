terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region"     { default = "eu-west-1" }  # eu-west-1 = Ireland
variable "key_name"       { description = "SSH key pair name" }
variable "instance_type"  { default = "t3.small" }
variable "ami_id"         { description = "Amazon Linux 2023 AMI ID" }

variable "allowed_ssh_ip"          { default = "0.0.0.0/0" }
variable "allowed_ip_client_a"     { default = "0.0.0.0/0" }
variable "allowed_ip_client_b"     { default = "0.0.0.0/0" }
variable "allowed_ip_admin"        { default = "0.0.0.0/0" }
variable "allowed_ip_production"   { default = "0.0.0.0/0" }
variable "allowed_ip_monitoring"   { default = "0.0.0.0/0" }

resource "aws_security_group" "infractrl" {
  name        = "infractrl-sg"
  description = "InfraCtrl Orders"
  tags        = { Name = "infractrl-sg", Project = "infractrl" }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_ip]
  }

  ingress {
    description = "Client A"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip_client_a]
  }

  ingress {
    description = "Client B"
    from_port   = 3002
    to_port     = 3002
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip_client_b]
  }

  ingress {
    description = "Admin"
    from_port   = 3003
    to_port     = 3003
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip_admin]
  }

  ingress {
    description = "Production"
    from_port   = 3004
    to_port     = 3004
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip_production]
  }

  ingress {
    description = "API (internal only)"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["127.0.0.1/32"]
  }

  ingress {
    description = "Grafana"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip_monitoring]
  }

  ingress {
    description = "Prometheus"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip_monitoring]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "infractrl" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.infractrl.id]

  associate_public_ip_address = true

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    tags        = { Name = "infractrl-data" }
  }

  user_data = <<-USERDATA
    #!/bin/bash
    set -ex
    dnf update -y
    dnf install -y docker git curl --allowerasing
    systemctl enable docker && systemctl start docker
    usermod -aG docker ec2-user
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
    chmod 666 /var/run/docker.sock
  USERDATA

  tags = { Name = "infractrl-server", Project = "infractrl" }
}

output "instance_id" {
  value = aws_instance.infractrl.id
}

output "server_ip" {
  value       = aws_instance.infractrl.public_ip
  description = "Public IP — changes on stop/start unless Elastic IP is used"
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_instance.infractrl.public_ip}"
}

output "app_urls" {
  value = {
    client_a   = "http://${aws_instance.infractrl.public_ip}:3001"
    client_b   = "http://${aws_instance.infractrl.public_ip}:3002"
    admin      = "http://${aws_instance.infractrl.public_ip}:3003"
    production = "http://${aws_instance.infractrl.public_ip}:3004"
    api_docs   = "http://${aws_instance.infractrl.public_ip}:8000/docs"
    grafana    = "http://${aws_instance.infractrl.public_ip}:3000"
    prometheus = "http://${aws_instance.infractrl.public_ip}:9090"
  }
}

output "stop_command" {
  value = "aws ec2 stop-instances --region ${var.aws_region} --instance-ids ${aws_instance.infractrl.id}"
}

output "start_command" {
  value = "aws ec2 start-instances --region ${var.aws_region} --instance-ids ${aws_instance.infractrl.id}"
}
