// createProject.js

const fs = require('fs');
const path = require('path');

// Definir la estructura del proyecto
const projectStructure = {
  'mi-proyecto-node': {
    'src': {
      'controllers': {},
      'models': {},
      'routes': {}
    },
    'public': {},
    'views': {},
    'index.js': `const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

// Crear el servidor
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('¡Hola Mundo!\\n');
});

// Iniciar el servidor
server.listen(port, hostname, () => {
  console.log(\`Servidor corriendo en http://\${hostname}:\${port}/\`);
});
`,
    'package.json': `{
  "name": "mi-proyecto-node",
  "version": "1.0.0",
  "description": "Proyecto básico de Node.js con estructura automatizada",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "nodemon": "^2.0.0"
  }
}
`,
    '.gitignore': `node_modules/
.env
`
  }
};

// Función para crear carpetas y archivos recursivamente
function createStructure(basePath, structure) {
  for (const name in structure) {
    const itemPath = path.join(basePath, name);
    if (typeof structure[name] === 'object' && !Array.isArray(structure[name])) {
      // Es una carpeta
      if (!fs.existsSync(itemPath)) {
        fs.mkdirSync(itemPath, { recursive: true });
        console.log(`Carpeta creada: ${itemPath}`);
      }
      // Llamada recursiva para subcarpetas
      createStructure(itemPath, structure[name]);
    } else {
      // Es un archivo
      if (!fs.existsSync(itemPath)) {
        fs.writeFileSync(itemPath, structure[name], 'utf8');
        console.log(`Archivo creado: ${itemPath}`);
      } else {
        console.log(`Archivo ya existe: ${itemPath}`);
      }
    }
  }
}

// Ruta donde se creará el proyecto (puedes modificarla según tus necesidades)
const targetPath = path.join(process.cwd());

// Crear la estructura del proyecto
createStructure(targetPath, projectStructure);

// Inicializar npm y agregar nodemon como dependencia de desarrollo
console.log('\nInicializando npm y instalando dependencias...');
const { exec } = require('child_process');

exec('npm init -y', { cwd: path.join(targetPath, 'mi-proyecto-node') }, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error al inicializar npm: ${error.message}`);
    return;
  }
  console.log(stdout);
  console.error(stderr);

  // Instalar nodemon como dependencia de desarrollo
  exec('npm install --save-dev nodemon', { cwd: path.join(targetPath, 'mi-proyecto-node') }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al instalar nodemon: ${error.message}`);
      return;
    }
    console.log(stdout);
    console.error(stderr);
    console.log('Proyecto creado exitosamente.');
    console.log('Para iniciar el servidor, navega a la carpeta del proyecto y ejecuta "npm run dev".');
  });
});
