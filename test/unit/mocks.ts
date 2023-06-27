import { Event, Object3D, Quaternion, Vector3 } from "three";
import {
  EventDispatcher,
  EventTranslator,
  XIntersection,
  voidObject,
} from "../../src/index.js";

export class MockInputDevice {
  private translator: EventTranslator<{ inputDeviceId: number }>;
  private intersections: Array<XIntersection> = [];
  private pressedElementIds: Map<Object3D, Array<number>> | Array<number> = [];

  public position = new Vector3();
  public rotation = new Quaternion();

  constructor(
    public readonly id: number,
    onPressMissed?: (event: {}) => void,
    onReleaseMissed?: (event: {}) => void,
    onSelectMissed?: (event: {}) => void,
    onIntersections?: (intersections: ReadonlyArray<XIntersection>) => void,
    filterIntersections?: (
      intersections: Array<XIntersection>
    ) => Array<XIntersection>,
    isDragged?: (inputDeviceElementId: number) => boolean
  ) {
    this.translator = new EventTranslator(
      id,
      false,
      new MockEventDispatcher(onPressMissed, onReleaseMissed, onSelectMissed),
      (event, objects) =>
        objects == null
          ? this.intersections
          : Array.from(objects.keys()).map((object) => ({
              distance: 0,
              object,
              point: new Vector3(),
              inputDevicePosition: new Vector3(),
              inputDeviceRotation: new Quaternion(),
              capturedObject: object,
            })),

      (intersection) =>
        Array.isArray(this.pressedElementIds)
          ? this.pressedElementIds
          : intersection != null
          ? this.pressedElementIds.get(intersection.object) ?? []
          : [],
      (position, rotation) => {
        position.copy(this.position);
        rotation.copy(this.rotation);
      },
      isDragged
    );
    this.translator.onIntersections = onIntersections;
    this.translator.filterIntersections = filterIntersections;
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

  constructor(
    protected onPressMissed?: (event: {}) => void,
    protected onReleaseMissed?: (event: {}) => void,
    protected onSelectMissed?: (event: {}) => void
  ) {}

  private createTarget(
    translator: EventTranslator<any>,
    object: Object3D,
    intersection: XIntersection
  ): PointerCaptureTarget {
    return {
      hasPointerCapture: translator.hasEventCapture.bind(translator, object),
      releasePointerCapture: translator.removeEventCapture.bind(
        translator,
        {},
        object
      ),
      setPointerCapture: translator.addEventCapture.bind(
        translator,
        {},
        object,
        intersection
      ),
    };
  }

  press(
    eventObject: Object3D,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("press")) {
      return;
    }
    if (eventObject === voidObject) {
      this.onPressMissed?.(intersection);
      return;
    }
    eventObject.dispatchEvent({
      type: "press",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("press");
      },
    });
  }
  release(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("release")) {
      return;
    }
    if (eventObject === voidObject) {
      this.onReleaseMissed?.(intersection);
      return;
    }
    eventObject.dispatchEvent({
      type: "release",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("release");
      },
    });
  }
  cancel(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("cancel")) {
      return;
    }
    eventObject.dispatchEvent({
      type: "cancel",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("cancel");
      },
    });
  }
  select(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("select")) {
      return;
    }
    if (eventObject === voidObject) {
      this.onSelectMissed?.(intersection);
      return;
    }
    eventObject.dispatchEvent({
      type: "select",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("select");
      },
    });
  }
  move(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("move")) {
      return;
    }
    eventObject.dispatchEvent({
      type: "move",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("move");
      },
    });
  }
  enter(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("enter")) {
      return;
    }
    eventObject.dispatchEvent({
      type: "enter",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("enter");
        this.translator.blockFollowingIntersections(eventObject);
      },
    });
  }
  leave(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("leave")) {
      return;
    }
    eventObject.dispatchEvent({
      type: "leave",
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      ...this.event,
      ...intersection,
      eventObject,
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("leave");
      },
    });
  }
  wheel(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("wheel")) {
      return;
    }
    eventObject.dispatchEvent({
      type: "wheel",
      ...this.event,
      ...intersection,
      eventObject,
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
      inputDeviceElementId,
      stopPropagation: () => {
        this.stoppedEventTypeSet.add("wheel");
      },
    });
  }
  losteventcapture(
    eventObject: Object3D<Event>,
    intersection: XIntersection,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedEventTypeSet.has("losteventcapture")) {
      return;
    }
    eventObject.dispatchEvent({
      type: "losteventcapture",
      ...this.event,
      ...intersection,
      eventObject,
      mockTarget: this.createTarget(this.translator, eventObject, intersection),
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
