# Raspberry Pi gateway agent

## What it does

- Registers with EnergyMonitor using a gateway bearer token
- Sends heartbeats and pulls allowlisted commands
- Buffers telemetry during outages and flushes when online
- Bridges local devices without exposing inbound ports on the PLC/meter

## What it does **not** do

- Execute arbitrary cloud shell or JavaScript
- Bypass local safety interlocks or emergency stops
- Open browser-side serial ports

## Install

```bash
cd gateway
npm install
cp ../.env.example /etc/energymonitor/gateway.env   # edit values
# ENERGYMONITOR_URL=https://your-app.example.com
# GATEWAY_TOKEN=gw_xxx.secret
npm start
```

### systemd

```bash
sudo cp energymonitor-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now energymonitor-gateway
```

## USB / RS-485 for Modbus RTU

- Use an isolated USB-RS-485 adapter
- Confirm `/dev/ttyUSB0` (or equivalent) permissions for the service user
- Document baud, parity, termination, and slave IDs before commissioning
