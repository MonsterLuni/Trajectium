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

  public multiplyVectorWithNumber(vector: Vector3D, factor: number) {
    return {
      x: vector.x * factor,
      y: vector.y * factor,
      z: vector.z * factor,
    } as Vector3D;
  }

  public rotationMatrixX(radians: number) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      m11: 1,
      m12: 0,
      m13: 0,
      m21: 0,
      m22: cos,
      m23: -sin,
      m31: 0,
      m32: sin,
      m33: cos,
    } as Matrix3D;
  }

  public rotationMatrixY(radians: number) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      m11: cos,
      m12: 0,
      m13: sin,
      m21: 0,
      m22: 1,
      m23: 0,
      m31: -sin,
      m32: 0,
      m33: cos,
    } as Matrix3D;
  }

  public rotationMatrixZ(radians: number) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      m11: cos,
      m12: -sin,
      m13: 0,
      m21: sin,
      m22: cos,
      m23: 0,
      m31: 0,
      m32: 0,
      m33: 1,
    } as Matrix3D;
  }
}
