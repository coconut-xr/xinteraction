# xinteraction

Web library for translating events from input devices (e.g. Mouse, XRController) into events on 3D Objects in a Three.js Scene.

## Input Device Events

*events received **from** the input device*

* **move** – issued when the input device is moved in any dimension (e.g. a mouse is moved)
* **press** – issued when a element in a input device is pressed (e.g. the left button of a mouse)
* **release** – issued when a element in a input device is released (e.g. the left button of a mouse)
* **cancel** - issued when the interaction of the input device is canceled (e.g. the user is selecting a text)
* **enter** – issued when a input device entered the application (e.g. a XR Controller is connected, a mouse entered the application-window)
* **leave** – issued when a input device left the application (e.g. a XR Controller is disconnected, a mouse left the application-window)

*Special Input Device Events*

* **wheel** — for input devices with a wheel, such as a mouse  *(mostly relates to scrolling)*

## 3D Object Events

*events dispatched to 3D Objects from Input Device identified by inputDeviceElementId*

* **press** – issued once when a input device is pressed and intersects with an object
* **release** – issued when a object has been pressed but is not anymore
* **cancel** - issued when the interaction of the input device is canceled while intersecting the object (e.g. the user is selecting a text)
* **select** – issued when a press and release event happened on an object
* **move** – issued when the input device moves while it intersects with an object
* **enter** – issued once when the input device  intersect with the object
* **leave** – issued when the input device doesn't intersect with the object anymore
*Special 3D Object Events*
* **wheel** – issued when the input device has a wheel event and the object is intersected
* **losteventcapture** - issued when the event capture is lost (e.g. when releasePointerCapture is called or the input device leaves)

## Intersection

The input device defines how it intersects with 3D objects in a scene. For instance, a mouse would use a raycaster, while a hand could use a sphere collider at the index finger. A input device can intersect multiple objects at once. The input device sorts the intersections. For each intersection events for the intersected object and its ancestors are created.

## Stop Propagation

Stopping the propagation for an event causes terminates the event propagation to the ancestors and to following intersections.

## Capture Input Device

If a input device is captured on one or multiple objects, the captured objects are used instead of the intersections.


## Input Device

A input device represents a unit with a positions and one or multiple input device elements. A input device element is a pressable or activateable element belonging to one input device with the same position as the input device. For instance, a input device can be a mouse and all buttons are input device elements. However, in case of a touch device, every individual pointer (finger) is a input device, since each pointer has its own position.

# TODO

[x] fix onPointerUp after pointer leave and reenter (write test for it)  
[x] manual down, up, cancel, and wheel for XSphereCollider
[x] bug: pointer events not on group  
[x] XLinePointer (allow teleport like pointer)  
[ ] spherecast on InstancedGlyphMesh from glpyh
[x] filter clipped events from Koestlich
[x] face normal info in intersection for sphere collision
[ ] quaternion on intersection (world quaternion of input device)
[x] Koestlich/glyph bug - always intersecting
[ ] test event (pointer) capture manually  
[ ] test on mobile device with multi touch  
[x] write tests for ray intersections  
[ ] write tests for lines intersections  
[x] write tests for collider intersections  
[x] visualize cursor at first hit point (onIntersect -> update cursor ref)  
[ ] write docs  