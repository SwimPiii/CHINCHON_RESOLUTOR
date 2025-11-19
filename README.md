# Chinchón Resolutor

**Asistente estadístico inteligente para el juego de cartas Chinchón** con baraja española de 40 cartas.

🎮 **[Jugar ahora](https://swimpiii.github.io/CHINCHON_RESOLUTOR/)**

## Características

- ✨ **Análisis estadístico** de cada jugada en tiempo real
- 🎯 **Recomendaciones inteligentes** basadas en probabilidades
- 🃏 **Detección automática de grupos** (escaleras y sets)
- 🎲 **Soporte para comodín** (1 de Oros opcional)
- 👥 **2-4 jugadores** con seguimiento de cartas conocidas
- 📊 **Contador de mazo** para saber cartas restantes
- 🔄 **Turnos automáticos** en sentido antihorario
- 💡 **Cierre inteligente** detecta cuándo puedes ganar

## Cómo usar

### 1. Configuración inicial
- **Número de jugadores**: Elige entre 2-4 jugadores
- **Comodín**: Activa si juegas con el 1 de Oros como comodín
- **Jugador inicial**: Selecciona quién empieza la ronda

### 2. Preparar tu mano
- Haz clic en los huecos de tu mano para seleccionar tus 7 cartas
- El selector permanecerá abierto hasta completar las 7 cartas
- Haz clic en "Descarte" para marcar la carta inicial visible en la mesa

### 3. Iniciar la ronda
- El botón "Iniciar ronda" se activará cuando tengas 7 cartas y descarte marcado
- Una vez iniciada, los turnos seguirán automáticamente en sentido antihorario

### 4. Jugar tu turno
- **Recomendación automática**: Al llegar tu turno, verás la mejor jugada calculada
- **Ejecutar**: Usa los botones para realizar la acción recomendada:
  - "Tomar de mesa": Toma la carta visible con el descarte sugerido
  - "Robar oculta": Elige carta del mazo y descarta automáticamente
  - "Otra acción": Juega manualmente sin seguir la recomendación
- **Cerrar**: Si puedes ganar, aparecerá el botón "Cerrar ahora"

### 5. Turnos de rivales
- Los botones aparecen junto al jugador activo:
  - "Rival toma de mesa": Registra que cogió la carta visible
  - "Rival roba oculta": Registra que robó del mazo
- Después, haz clic en **una carta oculta de su mano** para seleccionar qué descartó
- Solo se mostrarán cartas posibles (no vistas anteriormente)

### 6. Finalizar
- Pulsa "Finalizar ronda" cuando alguien gane
- "Reiniciar" borra todo excepto número de jugadores y configuraciones

## Reglas del Chinchón

### Objetivo
Cerrar con **6 cartas agrupadas** y **1 carta suelta de valor ≤3** (1, 2 o 3).

### Chinchón
Si logras agrupar las **7 cartas** completas, ganas automáticamente.

### Grupos válidos
- **Sets**: 3 o más cartas del mismo número (ejemplo: 6♦ 6♣ 6♠)
- **Escaleras**: 3 o más cartas consecutivas del mismo palo (ejemplo: 5♥ 6♥ 7♥)

### Comodín (opcional)
El **1 de Oros** puede sustituir cualquier carta para completar grupos o escaleras.

### Turnos
**Antihorario**: Sur (tú) → Este → Norte → Oeste

### Baraja
**40 cartas** españolas (sin 8 ni 9):
- Oros, Copas, Espadas, Bastos
- Valores: 1-7, Sota (10), Caballo (11), Rey (12)

## Estrategia

El programa calcula:
- **Probabilidad de mejora** robando del mazo vs. tomar de mesa
- **Valor esperado** de cada descarte considerando grupos potenciales
- **Señales de rivales** (evita descartar cartas que pueden ayudarlos)
- **Cierre inmediato** cuando detecta que puedes ganar

## Tecnología

- **HTML5 + CSS3 + JavaScript puro**
- Sin dependencias externas ni frameworks
- Funciona **offline** una vez cargado
- Compatible con **móviles y tablets**
- Interfaz visual con cartas CSS (sin imágenes)

## Publicar en GitHub Pages

Este proyecto ya está configurado para GitHub Pages:

1. El repositorio está en: `https://github.com/SwimPiii/CHINCHON_RESOLUTOR`
2. GitHub Pages se activa automáticamente desde la rama `main`
3. Accede al juego en: `https://swimpiii.github.io/CHINCHON_RESOLUTOR/`

## Desarrollo futuro

- [ ] Sistema de tracking de reciclaje del mazo
- [ ] Búsqueda combinatoria óptima de particiones
- [ ] Modo defensivo avanzado para bloquear rivales
- [ ] Historial de partidas y estadísticas
- [ ] Análisis post-partida con replay

---

**Desarrollado con ❤️ para jugadores de Chinchón**
