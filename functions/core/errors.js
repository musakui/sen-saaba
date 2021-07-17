export class BadRequest {
  static code = 400
  constructor (message) {
    const { code, name } = this.constructor
    this.httpStatus = code
    this.error = name
    this.message = message
  }
}

export class Unauthorized extends BadRequest {
  static code = 401
}

export class Forbidden extends BadRequest {
  static code = 403
}

export class NotFound extends BadRequest {
  static code = 404
}
