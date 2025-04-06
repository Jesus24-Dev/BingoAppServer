# BingoAppServer

BingoAppServer es la contraparte del servidor para la aplicación BingoApp, diseñada para gestionar la lógica del juego y la comunicación entre los clientes en una partida de bingo en línea.

## Características

- **Gestión de partidas:** Administra la creación y el seguimiento de las partidas de bingo.
- **Comunicación en tiempo real:** Facilita la interacción entre jugadores y la actualización del estado del juego en tiempo real.
- **Configuración flexible:** Utiliza variables de entorno para configuraciones sensibles y adaptabilidad.

## Tecnologías Utilizadas

- **TypeScript:** Lenguaje principal del proyecto.
- **Node.js:** Entorno de ejecución para el servidor.
- **Express:** Framework para la creación de servidores web.
- **Socket.io:** Biblioteca para la comunicación en tiempo real entre el servidor y los clientes.

## Requisitos Previos

- **Node.js:** Asegúrate de tener Node.js instalado en tu sistema. Puedes descargarlo desde [aquí](https://nodejs.org/).

## Instalación

Sigue estos pasos para configurar el proyecto en tu entorno local:

1. **Clona el repositorio:**

```bash
   git clone https://github.com/Jesus24-Dev/BingoAppServer.git
```

2. **Navega al directorio del proyecto:**
    
```bash
  cd BingoAppServer
```
    
3. **Instala las dependencias:**
```bash
  npm install
```
    
4. **Inicia el servidor de desarrollo:**
```bash
  npm run dev
```
    
Luego, abre tu navegador y visita `http://localhost:3000` para ver la aplicación en funcionamiento.

## Contribuciones

¡Las contribuciones son bienvenidas! Si deseas colaborar en el proyecto, por favor sigue estos pasos:

1. **Fork del repositorio.**
    
2. **Crea una nueva rama:**
    
```bash
  git checkout -b feature/nueva-funcionalidad
```
    
3. **Realiza tus cambios y haz commit:**
    
```bash
  git commit -m 'Añadir nueva funcionalidad'
```
    
4. **Envía tus cambios al repositorio remoto:**
    
```bash
 git push origin feature/nueva-funcionalidad
```
    
    
5. **Abre una Pull Request.**
