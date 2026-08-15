# Start Next.js
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WorkingDirectory $PWD

# Start Ngrok (HTTPS preserved)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http `"https://localhost:3000`" --host-header=rewrite" -WorkingDirectory $PWD

# Start Stripe listener
Start-Process powershell -ArgumentList "-NoExit", "-Command", "stripe listen --forward-to https://localhost:3000/api/webhook" -WorkingDirectory $PWD
