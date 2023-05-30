# Approach

**update(event: E, positionChanged: boolean, pressChanged: boolean)**
called when the input device receives a press, release, or move event

The **positionChanged** flag indicates that the input device was moved and therefore requires the **sceneIntersections** to recompute. When the **sceneIntersections** are recomputed, we check whether objects where hovered or released and dispatch events accordingly.

The **pressChanged** flag indicates that any input device element was either pressed or released. Therefore, we check whether the objects in **sceneIntersections** are released or pressed and dispatch events accordingly.


