module.exports = {
  apps: [
    {
      name: "wisetrack-envio",
      script: "./envio.js",
      // args: "", // Si necesitas pasar argumentos
      instances: 1, // Cambia a "max" para clúster
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production"
        // Puedes agregar otras variables de entorno aquí si las necesitas
      }
    }
  ]
};