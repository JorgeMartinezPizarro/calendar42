# Calendar42

Calendario para estudiantes de 42 Madrid que reúne en una única vista la información temporal que la intra distribuye en diferentes apartados: eventos y exámenes, slots de corrección y correcciones planificadas.

El objetivo de Calendar42 es facilitar una **gestión eficiente del tiempo dentro de 42**, permitiendo visualizar y combinar diferentes tipos de actividad en un único calendario.

## El problema

Durante la experiencia en 42, la gestión del tiempo se convierte rápidamente en una parte importante de la organización del estudiante.

La idea de Calendar42 surgió a partir de la experiencia en la **Discovery de Python** y, posteriormente, en la **Piscina**, donde organizar los tiempos de estudio y de corrección resulta especialmente importante.

La información necesaria para organizarse está repartida por diferentes apartados de la intra:

- eventos;
- eventos a los que está inscrito el usuario;
- slots que un estudiante ofrece para corregir;
- correcciones planificadas;
- exámenes.

La intra dispone de una vista de calendario para los eventos, pero la información necesaria para organizar realmente el tiempo no está reunida en una única vista.

Esto puede provocar situaciones como **reservar una corrección en un horario en el que existe un evento al que se quiere asistir**.

El problema identificado es, por tanto, un problema de **gestión eficiente del tiempo**: la información existe, pero está fragmentada y resulta difícil obtener una visión global de cómo encajan todas las actividades entre sí.

La necesidad es especialmente visible en las primeras etapas de 42, cuando el estudiante todavía está descubriendo la plataforma y aprendiendo a organizarse. Pero la actividad de la escuela también incorpora cada vez más eventos, hackathons y oportunidades de interacción con empresas, por lo que disponer de una visión temporal unificada sigue teniendo valor a medida que el estudiante avanza.

## La solución

**Calendar42** crea una capa de calendario sobre la información de la intra y la reúne en una única vista.

El usuario puede conocer de un vistazo:

- qué eventos ofrece 42;
- a qué eventos está apuntado;
- qué exámenes tiene;
- qué slots tiene abiertos para corregir;
- qué correcciones tiene planificadas;
- y cómo se solapan todas estas actividades.

La información se organiza mediante **capas activables y desactivables**.

El objetivo no es sustituir la intra, sino crear una **capa de planificación temporal** sobre la información de 42.

## MVP desarrollado

Durante la hackathon se ha priorizado un MVP funcional centrado en el calendario de 42.

Actualmente Calendar42 integra:

- eventos del campus;
- eventos en los que participa el usuario;
- exámenes;
- slots de corrección abiertos;
- correcciones planificadas;
- vista mensual;
- vista diaria organizada por horas;
- filtros para activar y desactivar las diferentes capas;
- autenticación con la cuenta de 42 mediante OAuth.

## Ideación y prototipado

La idea partió de una necesidad experimentada directamente durante la experiencia de Discovery de Python y Piscina: para organizar el estudio no basta con conocer las actividades existentes, sino que es necesario saber **cómo encajan entre ellas en el tiempo**.

A partir de esta necesidad se planteó reunir en una única vista de calendario la información que actualmente está distribuida por diferentes apartados de la intra.

La funcionalidad clave identificada fue trabajar con diferentes **capas de información**, pudiendo activar o desactivar categorías y visualizar combinaciones como eventos junto con correcciones y slots.

El objetivo del prototipo fue comprobar si esta representación podía resolver el problema principal: disponer de una visión temporal unificada que permita detectar conflictos y organizar mejor el tiempo dedicado a 42.

El MVP se centró deliberadamente en esta primera pieza del producto, evitando ampliar durante la hackathon el alcance con funcionalidades que todavía no estaban implementadas.

## Equipo

### `svalero`

Conceptualización de la solución y definición del problema a partir de la experiencia como estudiante en 42.

- Propuesta inicial de Calendar42.
- Identificación del problema de gestión del tiempo.
- Definición de la idea y de las funcionalidades principales.
- Contribución a la definición funcional del producto.
- Preparación de la presentación y del pitch.

**Dedicación: 7 horas.**

### `jomarti3`

Desarrollo e implementación técnica del proyecto.

- Implementación del frontend.
- Implementación del backend.
- Integración con la API de 42.
- Implementación del sistema de autenticación.
- Integración y tratamiento de eventos, exámenes, slots y correcciones.
- Puesta en funcionamiento del MVP.

**Dedicación: 10 horas.**

## Organización del proyecto

El trabajo se dividió principalmente en dos bloques:

1. **Definición del problema y de la solución**, incluyendo la conceptualización de Calendar42 y la preparación de la presentación.
2. **Implementación técnica del MVP**, incluyendo frontend, backend e integración con la API de 42.

Esta división permitió concentrar el tiempo disponible en conseguir una primera versión funcional del producto y, posteriormente, preparar su presentación.

## Integración con la API de 42

Calendar42 utiliza la API de 42 como fuente de información para construir la agenda del usuario.

| Recurso | Para qué | Token |
|---|---|---|
| `GET /v2/me` | Usuario y campus principal tras el login | usuario |
| `GET /v2/campus/:id/events` | Eventos del campus | usuario |
| `GET /v2/users/:id/events` | Eventos en los que el usuario está inscrito | usuario |
| `GET /v2/campus/:id/exams` | Exámenes del campus | app |
| `GET /v2/users/:id/exams` | Exámenes en los que el usuario está inscrito | app |
| `GET /v2/me/slots` | Slots de corrección del usuario | usuario |
| `GET /v2/me/scale_teams` | Correcciones planificadas | usuario |
| `GET /v2/projects/:id` | Nombre del proyecto de una corrección | usuario |

### Decisiones y dificultades técnicas

- Los endpoints de exámenes devuelven `403` a los estudiantes, por lo que los exámenes se consultan utilizando el token de aplicación mediante `client_credentials`.
- La lista de inscritos de un examen (`/v2/exams/:id/exams_users`) está restringida a staff, por lo que para conocer los exámenes del usuario se utiliza `/v2/users/:id/exams`.
- Los endpoints relacionados con slots y correcciones requieren el scope `projects`.
- La API tiene un límite de 2 peticiones por segundo. Las llamadas pasan por un limitador.
- La agenda se cachea durante dos minutos por usuario y rango de fechas.
- El token de autenticación permanece en el backend y no se expone al navegador.

## Puesta en marcha

Necesitas Node 22 y una aplicación OAuth registrada en:

https://profile.intra.42.fr/oauth/applications

La aplicación debe utilizar como redirect URI:

`http://localhost:5173/api/auth/callback`

y los scopes:

`public` y `projects`.

```bash
nvm install 22
nvm use 22
npm install
cp .env.example .env
```

Rellena `FT_CLIENT_ID` y `FT_CLIENT_SECRET` en `.env` con el UID y SECRET de la aplicación OAuth.

Después:

```bash
npm run dev
```

La aplicación estará disponible en:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`

Sin credenciales, la aplicación puede arrancar en **modo demo con datos de ejemplo**.

## API propia

| Ruta | Descripción |
|---|---|
| `GET /api/auth/login` | Redirige al login de la intra |
| `GET /api/auth/callback` | Vuelta del login y creación de la sesión |
| `GET /api/auth/me` | Usuario de la sesión |
| `POST /api/auth/logout` | Cierra la sesión |
| `GET /api/agenda?from&to` | Eventos, exámenes, slots y correcciones entre dos fechas ISO |

## Estructura

```text
server/   Express: OAuth, sesiones y /api/agenda
          intra.js habla con la API de 42

src/      React: Calendar, DayView, TypeFilter, LoginView
          y carga de la agenda en App.jsx
```

## Evolución del producto

El MVP de Calendar42 se centra en resolver el problema principal: reunir en una única vista la información temporal que actualmente está distribuida por diferentes apartados de la intra.

### 1. Integración con calendarios personales

Una evolución natural sería permitir que un evento al que el estudiante se ha inscrito pueda añadirse directamente a su calendario personal.

Calendar42 mantendría la responsabilidad sobre la información de 42, mientras que el calendario personal seguiría siendo responsable de la vida personal del estudiante.

En una fase posterior, y siempre mediante autorización explícita del usuario, podría estudiarse una integración bidireccional para superponer compromisos personales y actividad de 42 y detectar conflictos o huecos disponibles.

### 2. Peer-to-peer incentivado

Otra posible evolución parte de los propios slots de corrección.

La propuesta sería:

**ofrecer tiempo a la comunidad → ayudar a otro estudiante → recibir un beneficio.**

El tipo de beneficio dependería de las posibilidades y criterios de 42 Madrid. Podría plantearse mediante horas o días adicionales, Altaris, reconocimiento u otros incentivos.

### 3. Presencialidad y comunidad

La misma lógica podría utilizarse para incentivar la asistencia a los clústers y la participación en actividades presenciales.

Calendar42 podría convertirse así en una capa que no solo informa de qué sucede en 42, sino que ayuda a **organizar el tiempo, favorecer la colaboración entre estudiantes y reforzar la comunidad presencial**.

Estas funcionalidades forman parte de la visión futura y **no se presentan como funcionalidades implementadas en el MVP**.

## Visión

Calendar42 empieza resolviendo un problema sencillo:

> **La información temporal de 42 está repartida.**

La primera respuesta es reunirla:

> **Una vista. Diferentes capas. Mejor planificación.**

La visión a largo plazo es convertir esa capa temporal en una herramienta que ayude al estudiante a decidir **cómo utilizar mejor su tiempo dentro y fuera de 42**.

## Datos del equipo

| Participante | Login 42 | Responsabilidad | Horas |
|---|---|---|---:|
| Sergio | `svalero` | Conceptualización, definición funcional y presentación | 7 h |
| Jorge | `jomarti3` | Desarrollo e implementación técnica | 10 h |

**Repositorio:** `https://github.com/JorgeMartinezPizarro/calendar42`
