import { Object3D, Event, Intersection } from "three";
import { EventDispatcher, EventTranslator } from "../index.js";
import { ThreeEvent, LocalState } from "@react-three/fiber";
import { EventHandlers } from "@react-three/fiber/dist/declarations/src/core/events.js";

export class R3FEventDispatcher implements EventDispatcher<Event> {
  private stoppedRef!: { stopped: boolean };
  private event!: Event;
  private translator!: EventTranslator<Event>;

  press = this.dispatch.bind(this, "onPointerDown");
  release = this.dispatch.bind(this, "onPointerUp");
  cancel = this.dispatch.bind(this, "onPointerCancel");
  select = this.dispatch.bind(this, "onClick");
  move = this.dispatch.bind(this, "onPointerMove");
  enter = this.dispatch.bind(this, "onPointerEnter");
  leave = this.dispatch.bind(this, "onPointerLeave");
  wheel = this.dispatch.bind(this, "onWheel");
  losteventcapture = () => {}; //this.dispatch.bind(this, "lostpointercapture")

  private dispatch(
    name: keyof EventHandlers,
    object: Object3D<Event>,
    intersection: Intersection<Object3D<Event>>,
    inputDeviceElementId?: number | undefined
  ): void {
    if (this.stoppedRef.stopped) {
      return;
    }
    const instance: LocalState = (object as any).__r3f;
    instance.handlers[name]?.(
      this.createEvent(object, intersection, inputDeviceElementId) as any
    );
  }

  private createEvent(
    object: Object3D,
    intersection: Intersection,
    inputDeviceElementId?: number | undefined
  ): ThreeEvent<Event> {
    const stoppedRef = this.stoppedRef;
    const target = {
      setPointerCapture: this.translator.addEventCapture.bind(
        this.translator,
        object
      ),
      releasePointerCapture: this.translator.removeEventCapture.bind(
        this.translator,
        object
      ),
      hasPointerCapture: this.translator.hasEventCapture.bind(
        this.translator,
        object
      ),
    };
    const data: ThreeEvent<Event> = {
      ...intersection,
      eventObject: object,
      pointer: null as any,
      intersections: null as any,
      stopped: null as any,
      delta: 0,
      unprojectedPoint: null as any,
      ray: null as any,
      camera: null as any,
      stopPropagation() {
        stoppedRef.stopped = true;
      },
      // there should be a distinction between target and currentTarget
      target: target,
      currentTarget: target,
      nativeEvent: this.event,
      inputDeviceElementId,
      inputDeviceId: this.translator.inputDeviceId,
    };

    //assign event properties to data
    for (let prop in this.event) {
      const property = this.event[prop as keyof Event];
      if (typeof property === "function") {
        continue;
      }
      data[prop] = property;
    }

    return data;
  }

  bind(event: Event, eventTranslator: EventTranslator<Event>): void {
    this.stoppedRef = { stopped: false };
    this.event = event;
    this.translator = eventTranslator;
  }

  hasEventHandlers(object: Object3D<Event>): boolean {
    const instance: LocalState = (object as any).__r3f;
    return instance != null && instance.eventCount > 0;
  }
}

export * from "./web-2d-pointers.js";
