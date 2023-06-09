//TODO: test lines event captures

import { expect } from "chai";
import { Object3D, Group, Mesh, BoxGeometry, Quaternion, Vector3 } from "three";
import { mockEventDispatcher } from "./ray.spec.js";
import { intersectLinesFromObject } from "../../src/intersections/lines.js";

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
