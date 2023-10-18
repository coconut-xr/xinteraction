/* eslint-disable react/display-name */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import { Object3D, Quaternion, Vector3, Event } from "three";
import { EventTranslator } from "../index.js";
import {
  XLinesIntersection,
  intersectLinesFromCapturedEvents,
  intersectLinesFromObject,
} from "../intersections/lines.js";
import {
  InputDeviceFunctions,
  R3FEventDispatcher,
  filterNewEntries,
} from "./index.js";
import { ThreeEvent, useFrame, useStore } from "@react-three/fiber";

const noPressedElementIds: Array<number> = [];

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
    pressedElementIds?: Array<number>;
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
      pressedElementIds: customPressedElementIds = noPressedElementIds,
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

    const pressedElementIds = useMemo(() => new Set<number>(), []);

    const properties = useMemo(
      () => ({
        points,
        filterClipped,
        customPressedElementIds: noPressedElementIds,
      }),
      []
    );
    properties.points = points;
    properties.filterClipped = filterClipped;
    const newCustomPressedElementIds = filterNewEntries(
      properties.customPressedElementIds,
      customPressedElementIds
    );
    let customPressedElementsChanged =
      properties.customPressedElementIds.length !=
        customPressedElementIds.length || newCustomPressedElementIds.length > 0;
    properties.customPressedElementIds = customPressedElementIds;

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
          () => [...pressedElementIds, ...properties.customPressedElementIds],
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
    //update translator every frame
    useFrame(() => {
      translator.update(
        {},
        true,
        customPressedElementsChanged,
        ...newCustomPressedElementIds
      );
      customPressedElementsChanged = false;
    });
    // eslint-disable-next-line react/no-unknown-property
    return <primitive object={object} />;
  }
);
