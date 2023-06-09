import { Event, Object3D, Quaternion, Vector3 } from "three";
import {
  EventDispatcher,
  EventTranslator,
  XIntersection,
} from "../../src/index.js";

export class MockInputDevice {
  private translator: EventTranslator<{ inputDeviceId: number }>;
  private intersections: Array<XIntersection> = [];
  private pressedElementIds: Map<Object3D, Array<number>> | Array<number> = [];

  constructor(public readonly id: number) {
    this.translator = new EventTranslator(
      id,
      false,
      new MockEventDispatcher(),
      (event, objects) =>
        objects == null
          ? this.intersections
          : Array.from(objects.keys()).map((object) => ({
              distance: 0,
              object,
              point: new Vector3(),
              inputDevicePosition: new Vector3(),
              inputDeviceRotation: new Quaternion(),
            })),
      (intersection) =>
        Array.isArray(this.pressedElementIds)
          ? this.pressedElementIds
          : this.pressedElementIds.get(intersection.object) ?? []
    );
  }

  update(
    intersections?: Array<XIntersection>,
    pressedElementIds?: Map<Object3D, Array<number>> | Array<number>,
    ...dispatchPressFor: Array<number>
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
      pressedElementIds != null,
      ...dispatchPressFor
    );
  }
}

type PointerCaptureTarget = {
  releasePointerCapture: (id: number) => void;
  setPointerCapture: (id: number) => void;
  hasPointerCapture: (id: number) => void;
};

class MockEventDispatcher implements EventDispatcher<{}, any> {
  private stoppedEventTypeSet = new Set<string>();
  private event: any;
  private translator: EventTranslator<any> = null as any;

  private createTarget(
    translator: EventTranslator<any>,
    object: Object3D,
    intersection: XIntersection
  ): PointerCaptureTarget {
    return {
      hasPointerCapture: translator.hasEventCapture.bind(translator, object),
      releasePointerCapture: translator.removeEventCapture.bind(
        translator,
        object
      ),
      setPointerCapture: translator.addEventCapture.bind(
        translator,
        object,
        intersection
      ),
    };
  }

  press(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("press")) {
      return;
    }
    object.dispatchEvent({
      type: "press",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("press");
      },
    });
  }
  release(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("release")) {
      return;
    }
    object.dispatchEvent({
      type: "release",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("release");
      },
    });
  }
  cancel(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("cancel")) {
      return;
    }
    object.dispatchEvent({
      type: "cancel",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("cancel");
      },
    });
  }
  select(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("select")) {
      return;
    }
    object.dispatchEvent({
      type: "select",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("select");
      },
    });
  }
  move(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("move")) {
      return;
    }
    object.dispatchEvent({
      type: "move",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("move");
      },
    });
  }
  enter(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("enter")) {
      return;
    }
    object.dispatchEvent({
      type: "enter",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("enter");
        this.translator.blockFollowingIntersections(object);
      },
    });
  }
  leave(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("leave")) {
      return;
    }
    object.dispatchEvent({
      type: "leave",
      mockTarget: this.createTarget(this.translator, object, intersection),
      ...this.event,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("leave");
      },
    });
  }
  wheel(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("wheel")) {
      return;
    }
    object.dispatchEvent({
      type: "wheel",
      ...this.event,
      mockTarget: this.createTarget(this.translator, object, intersection),
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("wheel");
      },
    });
  }
  losteventcapture(
    object: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("losteventcapture")) {
      return;
    }
    object.dispatchEvent({
      type: "losteventcapture",
      ...this.event,
      mockTarget: this.createTarget(this.translator, object, intersection),
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("losteventcapture");
      },
    });
  }
  bind(event: {}, translator: EventTranslator<{}>): void {
    this.event = event;
    this.stoppedEventTypeSet.clear();
    this.translator = translator;
  }
  hasEventHandlers(object: Object3D<Event>): boolean {
    return true;
  }
}
