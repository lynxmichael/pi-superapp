const { exec } = require('child_process');

const port = 3000;

if (process.platform === 'win32') {
  exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
    if (stdout) {
      const lines = stdout.split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      });
      
      pids.forEach(pid => {
        exec(`taskkill /PID ${pid} /F`, (err) => {
          if (!err) console.log(`✅ Processus ${pid} arrêté`);
        });
      });
      
      console.log('✅ Port 3000 libéré');
    }
  });
} else {
  exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
    if (!error) console.log('✅ Port 3000 libéré');
  });
}