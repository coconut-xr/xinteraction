/* eslint-disable react/display-name */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Object3D, Quaternion, Vector3, Event } from "three";
import { EventTranslator } from "../index.js";
import {
  XLinesIntersection,
  intersectLinesFromCapturedEvents,
  intersectLinesFromObject,
} from "../intersections/lines.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { ThreeEvent, useFrame, useStore } from "@react-three/fiber";

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

export const XCurvedPointer = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    points: Array<Vector3>;
    onIntersections?: (
      intersections: ReadonlyArray<XLinesIntersection>
    ) => void;
    filterIntersections?: (
      intersections: Array<XLinesIntersection>
    ) => Array<XLinesIntersection>;
    onPointerDownMissed?: (event: ThreeEvent<Event>) => void;
    onPointerUpMissed?: (event: ThreeEvent<Event>) => void;
    onClickMissed?: (event: ThreeEvent<Event>) => void;
    filterClipped?: boolean;
    initialPressedElementIds?: Array<number>;
  }
>(
  (
    {
      id,
      points,
      onIntersections,
      filterIntersections,
      onClickMissed,
      onPointerDownMissed,
      onPointerUpMissed,
      filterClipped = true,
      initialPressedElementIds,
    },
    ref
  ) => {
    const object = useMemo(() => new Object3D(), []);
    const store = useStore();

    const dispatcher = useMemo(
      () => new R3FEventDispatcher<XLinesIntersection>(),
      []
    );
    dispatcher.onPointerDownMissed = onPointerDownMissed;
    dispatcher.onPointerUpMissed = onPointerUpMissed;
    dispatcher.onClickMissed = onClickMissed;

    const pressedElementIds = useMemo(
      () => new Set<number>(initialPressedElementIds),
      []
    );

    const properties = useMemo(
      () => ({
        points,
        filterClipped,
      }),
      []
    );
    properties.points = points;
    properties.filterClipped = filterClipped;

    const translator = useMemo(
      () =>
        new EventTranslator<any, XLinesIntersection>(
          id,
          false,
          dispatcher,
          (_: any, capturedEvents?: Map<Object3D, XLinesIntersection>) => {
            object.getWorldPosition(worldPositionHelper);
            object.getWorldQuaternion(worldRotationHelper);

            return capturedEvents == null
              ? //events not captured -> compute normally
                intersectLinesFromObject(
                  object,
                  worldPositionHelper,
                  worldRotationHelper,
                  properties.points,
                  store.getState().scene,
                  dispatcher,
                  properties.filterClipped
                )
              : intersectLinesFromCapturedEvents(
                  object,
                  worldPositionHelper,
                  worldRotationHelper,
                  properties.points,
                  capturedEvents
                );
          },
          () => [...pressedElementIds],
          (position, rotation) => {
            object.getWorldPosition(position);
            object.getWorldQuaternion(rotation);
          }
        ),
      [id, store]
    );

    translator.onIntersections = onIntersections;
    translator.filterIntersections = filterIntersections;

    useImperativeHandle(
      ref,
      () => ({
        press: (id, event) => {
          pressedElementIds.add(id);
          translator.update(event, false, true, id);
        },
        release: (id, event) => {
          pressedElementIds.delete(id);
          translator.update(event, false, true);
        },
        cancel: translator.cancel.bind(translator),
        wheel(event) {
          translator.wheel(event);
        },
      }),
      [translator]
    );

    //cleanup translator
    useEffect(() => translator.leave.bind(translator, {} as any), [translator]);
    //update translator every frame (we use pressedElementsChangedRef to update the translator for the initial pressed elements)
    const pressedElementsChangedRef = useRef(pressedElementIds.size > 0); //is set initially to pressedElementsIds which is the same is initialPressedElements
    useFrame(() => {
      translator.update(
        {},
        true,
        pressedElementsChangedRef.current,
        ...pressedElementIds
      );
      pressedElementsChangedRef.current = false;
    });
    // eslint-disable-next-line react/no-unknown-property
    return <primitive object={object} />;
  }
);
