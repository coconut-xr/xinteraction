import { expect } from "chai";
import {
  Object3D,
  Group,
  Mesh,
  BoxGeometry,
  Vector3,
  Quaternion,
  Euler,
} from "three";
import { mockEventDispatcher } from "./ray.spec.js";
import {
  intersectSphereFromCapturedEvents,
  intersectSphereFromObject,
} from "../../src/intersections/sphere.js";

const worldPosition = new Vector3();
const worldRotation = new Quaternion();

//TODO: test sphere event captures

describe("sphere collider intersections", () => {
  it("should have no intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
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

    const intersections = intersectSphereFromObject(
      worldPosition,
      worldRotation,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([]);
  });
  it("should have one intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.8, 1, 1); //0.8 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);
    const intersections = intersectSphereFromObject(
      worldPosition,
      worldRotation,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh1.uuid]);
  });
  it("should have intersections with all objects sorted by distance", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.9, 1, 1); //0.9 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh2);
    mesh2.position.set(1, 0.5, 1); //0.5 offset
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);
    const intersections = intersectSphereFromObject(
      worldPosition,
      worldRotation,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh2.uuid,
      mesh1.uuid,
    ]);
    expect(intersections[0].distance).be.closeTo(-0.5, 0.0001);
    expect(intersections[1].distance).be.closeTo(-0.1, 0.0001);
  });
  it("should have intersection with closest from parent mesh and child mesh", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);

    const parent = new Mesh(new BoxGeometry(1, 1, 1));
    parent.position.set(1.9, 1, 1); //distance -0.1

    const child = new Mesh(new BoxGeometry(1, 1, 1));
    parent.add(child);
    child.position.set(0.5, 1, 1); //distance -0.5

    parent.updateMatrixWorld();
    child.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);
    const intersections = intersectSphereFromObject(
      worldPosition,
      worldRotation,
      0.5,
      0,
      parent,
      mockEventDispatcher
    );
    expect(intersections[0].distance).be.closeTo(-0.5, 0.0001);
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([child.uuid]);
  });
  it("should filter intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.9, 1, 1); //0.9 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh2);
    mesh2.position.set(1, 0.5, 1); //0.5 offset
    mesh2.updateMatrixWorld();

    const mesh3 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh3);
    mesh3.position.set(1, 1, 0.2); //0.8 offset
    mesh3.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);
    const intersections = intersectSphereFromObject(
      worldPosition,
      worldRotation,
      0.5,
      0,
      group,
      mockEventDispatcher,
      (is) => is.filter((i) => i.object != mesh2)
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh3.uuid,
      mesh1.uuid,
    ]);
    expect(intersections[0].distance).be.closeTo(-0.2, 0.0001);
    expect(intersections[1].distance).be.closeTo(-0.1, 0.0001);
  });

  it("should intersect the face with the correct normal", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.8, 1, 1); //0.8 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);
    const [intersection] = intersectSphereFromObject(
      worldPosition,
      worldRotation,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    const { x, y, z } = intersection.point;
    expect(x).be.closeTo(1.3, 0.0001);
    expect(y).be.closeTo(1, 0.0001);
    expect(z).be.closeTo(1, 0.0001);

    expect(intersection.face).to.not.be.undefined;
    const [nx, ny, nz] = intersection.face!.normal.toArray();
    expect(nx).be.closeTo(-1, 0.0001);
    expect(ny).be.closeTo(0, 0.0001);
    expect(nz).be.closeTo(0, 0.0001);
  });
});

describe("sphere collider intersections for captured events", () => {
  it("should return new intersections for all captured objects", () => {
    const object1 = new Object3D();
    const object2 = new Object3D();
    const intersections = intersectSphereFromCapturedEvents(
      new Vector3(),
      new Quaternion(),
      new Map([
        [
          object1,
          {
            distance: 0,
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
    const intersections = intersectSphereFromCapturedEvents(
      new Vector3(),
      new Quaternion(),
      new Map([
        [
          object3,
          {
            distance: 0,
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
  it("should move the intersection point in relation to the sphere colliders movement", () => {
    const object = new Object3D();
    const intersections = intersectSphereFromCapturedEvents(
      new Vector3(1, 0, 0), //move 1 to right
      new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0)), //rotate 90° to right
      new Map([
        [
          object,
          {
            distance: 0,
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
