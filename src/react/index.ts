import { Object3D, Event } from "three";
import { EventDispatcher, EventTranslator, XIntersection } from "../index.js";
import { ThreeEvent, LocalState } from "@react-three/fiber";
import { EventHandlers } from "@react-three/fiber/dist/declarations/src/core/events.js";

export class R3FEventDispatcher<I extends XIntersection>
  implements EventDispatcher<Event, I>
{
  private stoppedEventTypeSet!: Set<string>;
  private event!: Event;
  private translator!: EventTranslator<Event, I>;

  press = this.dispatch.bind(this, ["onPointerDown"]);
  release = this.dispatch.bind(this, ["onPointerUp"]);
  cancel = this.dispatch.bind(this, ["onPointerCancel"]);
  select = this.dispatch.bind(this, ["onClick"]);
  move = this.dispatch.bind(this, ["onPointerMove"]);
  enter = this.dispatch.bind(this, ["onPointerEnter", "onPointerOver"]);
  leave = this.dispatch.bind(this, ["onPointerLeave", "onPointerOut"]);
  wheel = this.dispatch.bind(this, ["onWheel"]);
  losteventcapture = () => {}; //this.dispatch.bind(this, "lostpointercapture")

  private dispatch(
    names: Array<keyof EventHandlers>,
    eventObject: Object3D<Event>,
    intersection: I,
    inputDeviceElementId?: number | undefined
  ): void {
    for (const name of names) {
      if (this.stoppedEventTypeSet.has(name)) {
        return;
      }
      const instance: LocalState = (eventObject as any).__r3f;
      instance.handlers[name]?.(
        this.createEvent(
          name,
          eventObject,
          intersection,
          inputDeviceElementId
        ) as any
      );
    }
  }

  private createEvent(
    name: string,
    eventObject: Object3D,
    intersection: I,
    inputDeviceElementId?: number | undefined
  ): ThreeEvent<Event> {
    const stoppedEventTypeSet = this.stoppedEventTypeSet;
    const translator = this.translator;
    const target = {
      setPointerCapture: this.translator.addEventCapture.bind(
        this.translator,
        eventObject,
        intersection
      ),
      releasePointerCapture: this.translator.removeEventCapture.bind(
        this.translator,
        eventObject
      ),
      hasPointerCapture: this.translator.hasEventCapture.bind(
        this.translator,
        eventObject
      ),
    };
    const data: ThreeEvent<Event> = {} as any;
    //assign event properties to data
    for (let prop in this.event) {
      const property = this.event[prop as keyof Event];
      if (typeof property === "function") {
        continue;
      }
      data[prop] = property;
    }
    Object.assign(data, intersection, {
      eventObject,
      pointer: null as any,
      intersections: null as any,
      stopped: null as any,
      delta: 0,
      unprojectedPoint: null as any,
      ray: null as any,
      camera: null as any,
      stopPropagation() {
        stoppedEventTypeSet.add(name);
        if (name != "onPointerEnter") {
          return;
        }
        translator.blockFollowingIntersections(eventObject);
      },
      pointerId: this.translator.inputDeviceId,
      // there should be a distinction between target and currentTarget
      target: target,
      currentTarget: target,
      nativeEvent: this.event,
      inputDeviceElementId,
      inputDeviceId: this.translator.inputDeviceId,
    });

    return data;
  }

  bind(event: Event, eventTranslator: EventTranslator<Event, I>): void {
    this.stoppedEventTypeSet = new Set();
    this.event = event;
    this.translator = eventTranslator;
  }

  hasEventHandlers(object: Object3D<Event>): boolean {
    const instance: LocalState = (object as any).__r3f;
    return instance != null && instance.eventCount > 0;
  }
}

export type InputDeviceFunctions = {
  press(id: number, event: any): void;
  release(id: number, event: any): void;
  cancel(event: any): void;
  wheel(event: any): void;
};

export * from "./web-pointers.js";
export * from "./straight-pointer.js";
export * from "./sphere-collider.js";
export * from "./curved-pointer.js";
