# Panel de staff de RockyAI

Aplicación React + TypeScript + Vite. Este directorio es un repositorio Git
independiente del backend AI_Agency.

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run preview
```

Los scripts están definidos en [package.json](package.json). `build` ejecuta
TypeScript y Vite; `lint` usa Oxlint. Ejecuta cada comando según la tarea.

[App.tsx](src/App.tsx) organiza la aplicación; [api.ts](src/api.ts) y
[pmsApi.ts](src/pmsApi.ts) contienen los clientes de API. Las páginas están en
`src/pages/`, los componentes en `src/components/` y los estilos en `src/styles/`
y [index.css](src/index.css). Lee [CLAUDE.md](CLAUDE.md) antes de cambiar el panel.
