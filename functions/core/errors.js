export class BadRequest {
  static code = 400
  static errName = 'Bad Request'
  constructor (message) {
    const { code, errName } = this.constructor
    this.httpStatus = code
    this.error = errName
    this.message = message
  }
}

export class Unauthorized extends BadRequest {
  static code = 401
  static errName = 'Unauthorized'
}

export class Forbidden extends BadRequest {
  static code = 403
  static errName = 'Forbidden'
}

export class NotFound extends BadRequest {
  static code = 404
  static errName = 'Not Found'
}
