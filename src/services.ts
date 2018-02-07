import 'reflect-metadata'
import { FieldDescriptor, FieldDescriptorDictionary } from '.'
import { map } from 'lodash'

export function createFieldDescriptor(prototype: any, propertyKey: string, descriptor?: PropertyDescriptor, options?: Partial<FieldDescriptor>) {
  let field: Partial<FieldDescriptor> = {
    nullable: false,
    isList: false,
  }

  if (options && options.type) {
    field = { ...field, ...options }

  } else {
    const fieldType = Reflect.getMetadata('design:type', prototype, propertyKey)

    switch (fieldType.name) {
      // with resolver
      case 'Function':
        const fieldReturnType = Reflect.getMetadata('design:returntype', prototype, propertyKey)
        if (!fieldReturnType || fieldReturnType.name === 'Promise') {
          throw new Error(`Specify field type of '${propertyKey}' in '${prototype.constructor.name}'. ex) @Field(String)`)
        }
        field.type = fieldReturnType
        break

      case 'Array':
      case 'Object':
        throw new Error(`Specify field type of '${propertyKey}' in '${prototype.constructor.name}'. ex) @Field(String)`)

      default:
        field.type = fieldType
        break
    }
  }

  if (descriptor && descriptor.value) {
    field.resolver = descriptor.value
  }

  return field as FieldDescriptor
}


export function setLiteral(prototype: any, literal: string) {
  Reflect.defineMetadata('graphql:literal', literal, prototype)
}


export function getLiteral(prototype: any): string {
  return Reflect.getMetadata('graphql:literal', prototype)
}


export function addField(prototype: any, fieldName: string, field: FieldDescriptor) {
  const fields = getFields(prototype)
  fields[fieldName] = field
  setFields(prototype, fields)
}


function setFields(prototype: any, fields: { [fieldName: string]: FieldDescriptor }) {
  Reflect.defineMetadata('graphql:fields', fields, prototype)
}


export function getFields(prototype: any): FieldDescriptorDictionary {
  return Reflect.getMetadata('graphql:fields', prototype) || {}
}


export function setFieldOptions(
  prototype: any,
  fieldName: string,
  options: Partial<FieldDescriptor>
) {
  const fields = getFields(prototype)
  fields[fieldName] = {
    ...fields[fieldName],
    ...options,
  }
  setFields(prototype, fields)
}


function setMutations(prototype: any, mutations: FieldDescriptorDictionary) {
  Reflect.defineMetadata('graphql:mutations', mutations, prototype)
}


export function getMutations(prototype: any): FieldDescriptorDictionary {
  return Reflect.getMetadata('graphql:mutations', prototype) || {}
}


export function addMutation(prototype: any, mutationName: string, mutation: FieldDescriptor) {
  const mutations = getMutations(prototype)
  mutations[mutationName] = mutation
  setMutations(prototype, mutations)
}


export function getFieldLiteral(prototype: any, fieldName: string): string {
  const field = getFields(prototype)[fieldName]
  return `${
    fieldName
  }${
    getArgumentLiterals(prototype, fieldName)
  }: ${
    field.isList ? '[' : ''
  }${
    field.type.name
  }${
    field.isList ? ']' : ''
  }${
    field.nullable ? '' : '!'
  }`
}


export function getMutationLiteral(prototype: any, mutationName: string) {
  const mutation = getMutations(prototype)[mutationName]
  return `
    extend type Mutation {
      \t${
        mutationName
      }${
        getArgumentLiterals(prototype, mutationName)
      }: ${
        mutation.isList ? '[' : ''
      }${
        mutation.type.name
      }${
        mutation.isList ? ']' : ''
      }${
        mutation.nullable ? '' : '!'
      }
    }
  `
}


function getArgumentLiterals(prototype: any, resolverName: string) {
  const argumentType = getArgumentType(prototype, resolverName)
  if (!argumentType) return ''

  const argumentFields = getFields(argumentType.prototype)
  const argumentLiterals = map(argumentFields, (_: FieldDescriptor, argumentName) => {
    return getFieldLiteral(argumentType.prototype, argumentName)
  })
  return argumentLiterals.length ? `(${argumentLiterals.join(', ')})` : ''
}


function getArgumentType(prototype: any, resolverName: string) {
  const resolverArgumentTypes = Reflect.getMetadata('design:paramtypes', prototype, resolverName)
  if (!resolverArgumentTypes || !resolverArgumentTypes[1]) return

  const argumentType = resolverArgumentTypes[1]
  if (argumentType.name === 'Object') {
    throw new Error(`The second parameter type of ${resolverName} must be a class including Input type fields.`)
  }
  return argumentType
}
