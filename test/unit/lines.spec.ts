import { expect } from "chai";
import { Object3D, Group, Mesh, BoxGeometry, Quaternion, Vector3 } from "three";
import { mockEventDispatcher } from "./ray.spec.js";
import {
  intersectLinesFromCapturedEvents,
  intersectLinesFromObject,
} from "../../src/intersections/lines.js";

const worldPosition = new Vector3();
const worldRotation = new Quaternion();

const curvedLine: Array<Vector3> = [
  new Vector3(0, 0, 0),
  new Vector3(1, 0, 0),
  new Vector3(1, 0, 1),
];

describe("lines intersections", () => {
  it("should not contain objects multiple times", () => {
    const from = new Object3D();
    //curved pointer goes -1 in z then 1 in x
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(4, 4, 4));
    group.add(mesh1);
    mesh1.position.set(0, 0, 10);
    mesh1.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectLinesFromObject(
      from,
      worldPosition,
      worldRotation,
      [
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 100),
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 100),
      ],
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh1.uuid]);
  });
  it("should have no intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    //curved pointer goes -1 in z then 1 in x
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(3, 3, 1);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectLinesFromObject(
      from,
      worldPosition,
      worldRotation,
      curvedLine,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([]);
  });
  it("should have one intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    //curved pointer goes -1 in z then 1 in x
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(2, 1, 0);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectLinesFromObject(
      from,
      worldPosition,
      worldRotation,
      curvedLine,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh1.uuid]);
  });
  it("should have intersections with all objects sorted by distance", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    //curved pointer goes -1 in z then 1 in x
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(1.6, 1, 0);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(1, 1, 0);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectLinesFromObject(
      from,
      worldPosition,
      worldRotation,
      curvedLine,
      group,
      mockEventDispatcher
    );

    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh2.uuid,
      mesh1.uuid,
    ]);
    expect(intersections[0].distance).be.closeTo(0.5, 0.0001);
    expect(intersections[1].distance).be.closeTo(1.1, 0.0001);
  });
  it("should have intersection with closest from parent mesh and child mesh", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    //curved pointer goes -1 in z then 1 in x

    const parent = new Mesh(new BoxGeometry());
    parent.position.set(1.6, 1, 0);
    parent.updateMatrixWorld();

    const child = new Mesh(new BoxGeometry());
    parent.add(child);
    child.position.set(1, 1, 0);
    child.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectLinesFromObject(
      from,
      worldPosition,
      worldRotation,
      curvedLine,
      parent,
      mockEventDispatcher
    );

    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      child.uuid,
      parent.uuid,
    ]);
  });
  it("should filter intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    //curved pointer goes -1 in z then 1 in x
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(1, 1, 0);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(1, 1, -0.1);
    mesh2.updateMatrixWorld();

    const mesh3 = new Mesh(new BoxGeometry());
    group.add(mesh3);
    mesh3.position.set(2.1, 1, 0);
    mesh3.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectLinesFromObject(
      from,
      worldPosition,
      worldRotation,
      curvedLine,
      group,
      mockEventDispatcher,
      (is) => is.filter((i) => i.object != mesh1)
    );

    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh2.uuid,
      mesh3.uuid,
    ]);
  });
});

describe("lines intersections for captured events", () => {
  it("should return new intersections for all captured objects", () => {
    const object1 = new Object3D();
    const object2 = new Object3D();
    const from = new Object3D();
    const intersections = intersectLinesFromCapturedEvents(
      from,
      from.getWorldPosition(new Vector3()),
      from.getWorldQuaternion(new Quaternion()),
      [new Vector3(0, 0, 0), new Vector3(0, 0, 1)],
      new Map([
        [
          object1,
          {
            distance: 0,
            distanceOnLine: 1,
            lineIndex: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object1,
            point: new Vector3(),
          },
        ],
        [
          object2,
          {
            distance: 0,
            distanceOnLine: 1,
            lineIndex: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object2,
            point: new Vector3(),
          },
        ],
      ])
    );
    expect(intersections.map((i) => i.object)).to.deep.equal([
      object1,
      object2,
    ]);
  });
  it("should target the intersections directly to the captured objects", () => {
    const object1 = new Object3D();
    const object2 = new Object3D();
    const object3 = new Object3D();
    const object4 = new Object3D();
    const from = new Object3D();
    const intersections = intersectLinesFromCapturedEvents(
      from,
      from.getWorldPosition(new Vector3()),
      from.getWorldQuaternion(new Quaternion()),
      [new Vector3(0, 0, 0), new Vector3(0, 0, 1)],
      new Map([
        [
          object3,
          {
            distance: 0,
            distanceOnLine: 1,
            lineIndex: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object1,
            point: new Vector3(),
          },
        ],
        [
          object4,
          {
            distance: 0,
            distanceOnLine: 1,
            lineIndex: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object2,
            point: new Vector3(),
          },
        ],
      ])
    );
    expect(intersections.map((i) => i.capturedObject)).to.deep.equal([
      object3,
      object4,
    ]);
  });
  it("should move the intersection point in relation to the lines movement", () => {
    const object = new Object3D();
    const from = new Object3D();
    from.position.x = 1; //move 1 to right
    from.rotation.y = Math.PI / 2; //rotate 90° to right
    const intersections = intersectLinesFromCapturedEvents(
      from,
      from.getWorldPosition(new Vector3()),
      from.getWorldQuaternion(new Quaternion()),
      [new Vector3(0, 0, 0), new Vector3(0, 0, 1)],
      new Map([
        [
          object,
          {
            distance: 0,
            distanceOnLine: 1,
            lineIndex: 0,
            inputDevicePosition: new Vector3(0, 0, 0),
            inputDeviceRotation: new Quaternion(),
            object: object,
            point: new Vector3(0, 0, 1),
          },
        ],
      ])
    );
    expect(intersections[0].point.x).be.closeTo(2, 0.0001);
    expect(intersections[0].point.y).be.closeTo(0, 0.0001);
    expect(intersections[0].point.z).be.closeTo(0, 0.0001);
  });
});
