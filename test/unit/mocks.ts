import { Event, Intersection, Object3D, Vector3 } from "three";
import { EventDispatcher, EventTranslator } from "../../src/index.js";

export class MockInputDevice {
  private translator: EventTranslator<{ inputDeviceId: number }>;
  private intersections: Array<Intersection> = [];
  private pressedElementIds: Map<Object3D, Array<number>> | Array<number> = [];

  constructor(public readonly id: number, onPointerMissed: () => void) {
    this.translator = new EventTranslator(
      new MockEventDispatcher(),
      (event, objects) =>
        objects == null
          ? this.intersections
          : objects.map((object) => ({
              distance: 0,
              object,
              point: new Vector3(),
            })),
      (intersection) =>
        Array.isArray(this.pressedElementIds)
          ? this.pressedElementIds
          : this.pressedElementIds.get(intersection.object) ?? [],
      onPointerMissed
    );
  }

  update(
    intersections?: Array<Intersection>,
    pressedElementIds?: Map<Object3D, Array<number>> | Array<number>
  ): void {
    if (intersections != null) {
      this.intersections = intersections;
    }
    if (pressedElementIds != null) {
      this.pressedElementIds = pressedElementIds;
    }
    this.translator.update(
      { inputDeviceId: this.id },
      intersections != null,
      pressedElementIds != null
    );
  }
}

type PointerCaptureTarget = {
  releasePointerCapture: (id: number) => void;
  setPointerCapture: (id: number) => void;
  hasPointerCapture: (id: number) => void;
};

class MockEventDispatcher implements EventDispatcher<{}> {
  private stopped = false;
  private event: any;
  private translator: EventTranslator<any> = null as any;

  private createTarget(
    translator: EventTranslator<any>,
    object: Object3D
  ): PointerCaptureTarget {
    return {
      hasPointerCapture: translator.hasEventCapture.bind(translator, object),
      releasePointerCapture: translator.removeEventCapture.bind(
        translator,
        object
      ),
      setPointerCapture: translator.addEventCapture.bind(translator, object),
    };
  }

  press(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "press",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  release(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "release",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  cancel(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "cancel",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  select(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "select",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  move(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "move",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  enter(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "enter",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  leave(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "leave",
      mockTarget: this.createTarget(this.translator, object),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  wheel(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "wheel",
      ...this.event,
      mockTarget: this.createTarget(this.translator, object),
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  losteventcapture(
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stopped) {
      return;
    }
    object.dispatchEvent({
      type: "losteventcapture",
      ...this.event,
      mockTarget: this.createTarget(this.translator, object),
      inputDeviceElementId,
      stopPropagation: () => {
        this.stopped = true;
      },
    });
  }
  bind(event: {}, translator: EventTranslator<{}>): void {
    this.event = event;
    this.stopped = false;
    this.translator = translator;
  }
  hasEventHandlers(object: Object3D<Event>): boolean {
    return true;
  }
}
