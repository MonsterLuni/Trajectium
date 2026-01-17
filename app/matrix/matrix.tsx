export type Vector3D = {
  x: number;
  y: number;
  z: number;
};

export type Matrix3D = {
  m11: number;
  m12: number;
  m13: number;
  m21: number;
  m22: number;
  m23: number;
  m31: number;
  m32: number;
  m33: number;
};

export default class MatrixService {
  public multiplyVectorWithMatrix(
    vector: Vector3D,
    matrix: Matrix3D,
  ): Vector3D {
    return {
      x: vector.x * matrix.m11 + vector.y * matrix.m12 + vector.z * matrix.m13,
      y: vector.x * matrix.m21 + vector.y * matrix.m22 + vector.z * matrix.m23,
      z: vector.x * matrix.m31 + vector.y * matrix.m32 + vector.z * matrix.m33,
    };
  }

  public addVectors(vector: Vector3D, secondVector: Vector3D): Vector3D {
    return {
      x: vector.x + secondVector.x,
      y: vector.y + secondVector.y,
      z: vector.z + secondVector.z,
    };
  }
}
