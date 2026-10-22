#!/bin/bash
# Script to generate self-signed certificates for development/testing
# For production, use proper CA-signed certificates

mkdir -p certs

openssl req -x509 -newkey rsa:4096 -keyout certs/server-key.pem -out certs/server-cert.pem \
  -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=BankManagementSystem/CN=localhost"

echo "Self-signed certificates generated in certs/ directory"
echo "NOTE: These are for development only. Use CA-signed certificates in production."
