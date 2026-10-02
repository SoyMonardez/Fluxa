// Componentes que se cargan aparte (la primera pantalla aparece antes) y se
// precargan enseguida: cuando se abren ya están listos, sin parpadeos.
// A diferencia de React.lazy, si el código ya llegó se dibuja en el acto.
import { createElement } from 'react';

const todos = [];

export function perezoso(cargar) {
  let modulo = null;
  let promesa = null;
  const precargar = () => (promesa ??= cargar().then((m) => (modulo = m)));
  function Perezoso(props) {
    if (modulo) return createElement(modulo.default, props);
    throw precargar(); // Suspense muestra el "cargando" hasta que llegue
  }
  todos.push(precargar);
  return Perezoso;
}

/** Trae todo lo que falta (después de mostrar la primera pantalla). */
export function precargarTodo() {
  for (const f of todos) f().catch(() => {});
}
