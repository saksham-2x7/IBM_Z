#!/usr/bin/env bash
# Run ON the LinuxONE VM (as linux1). Needs only git + python3, both standard on RHEL.
#   curl -fsSL https://raw.githubusercontent.com/saksham-2x7/IBM_Z/main/scripts/setup_linuxone.sh | bash
set -e
cd ~
[ -d IBM_Z ] && git -C IBM_Z pull -q || git clone -q https://github.com/saksham-2x7/IBM_Z.git
cd IBM_Z
pkill -f "ml/serve.py" 2>/dev/null || true
nohup python3 ml/serve.py 8080 > ~/auraz.log 2>&1 &
sleep 1; cat ~/auraz.log
sudo -n firewall-cmd --add-port=8080/tcp 2>/dev/null || true
echo "Test: curl localhost:8080/health   |   In the app: IBM Z tab -> endpoint http://<VM-IP>:8080"
