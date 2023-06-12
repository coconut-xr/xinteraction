## Input Device

An input device represents a unit with a position and one or multiple input device elements. An input device element is a pressable or activatable element belonging to one input device with the same position as the input device. For instance, an input device can be a mouse, and all buttons are input device elements. However, in the case of a touch device, every individual pointer (finger) is an input device since each pointer has its own position.

## Input Device Events

*events received **from** a input device*

* **move** – issued when the input device is moved in any dimension (e.g., a mouse is moved)
* **press** – issued when an element in an input device is pressed (e.g., the left button of a mouse)
* **release** – issued when an element in an input device is released (e.g., the left button of a mouse)
* **cancel** - issued when the interaction of the input device is canceled (e.g., the user is selecting a text)
* **enter** – issued when an input device enters the application (e.g., an XR Controller is connected, a mouse enters the application-window)
* **leave** – issued when an input device leaves the application (e.g., a XR Controller is disconnected, a mouse leaves the application-window)

*Special Input Device Events*

* **wheel** — for input devices with a wheel, such as a mouse  *(mostly relates to scrolling)*

## 3D Object Events

*events dispatched to 3D Objects from Input Device identified by inputDeviceElementId*

* **press** – issued once when an input device is pressed and intersects with an object
* **release** – issued when an object has been pressed but is not anymore
* **cancel** - issued when the interaction of the input device is canceled while intersecting the object (e.g., the user is selecting a text)
* **select** – issued when a press and release event happened on an object
* **move** – issued when the input device moves while it intersects with an object
* **enter** – issued once when the input device intersects with the object
* **leave** – issued when the input device doesn't intersect with the object anymore
*Special 3D Object Events*
* **wheel** – issued when the input device has a wheel event, and the object is intersected
* **losteventcapture** - issued when the event capture is lost (e.g., when releasePointerCapture is called or the input device leaves)

## Intersection

The input device defines how it intersects with 3D objects in a scene. For instance, a mouse would use a raycaster, while a hand could use a sphere collider at the index finger. An input device can intersect multiple objects at once. The input device sorts the intersections. For each intersection, events for the intersected object and its ancestors are created.

## Stop Propagation

Stopping the propagation for an event terminates the event propagation to the ancestors and following intersections.

## Capture Input Device

If an input device is captured on one or multiple objects, the captured objects are used instead of the intersections.