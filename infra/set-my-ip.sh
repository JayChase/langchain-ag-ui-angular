#!/bin/bash

set -euo pipefail

ip=$(curl -s https://api.ipify.org || true)

if [[ ! "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Error: could not determine a valid public IPv4 address; Cognitive Services firewall exception will not be set." >&2
  exit 1
fi

for octet in ${ip//./ }; do
  if (( octet > 255 )); then
    echo "Error: invalid public IP address '$ip'; Cognitive Services firewall exception will not be set." >&2
    exit 1
  fi
done

azd env set AZURE_MY_IP_ADDRESS "$ip"
