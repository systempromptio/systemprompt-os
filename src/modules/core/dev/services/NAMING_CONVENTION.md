# Service Naming Convention

All services in a module must follow this naming convention:

## Service File Location
- Main service file: `/services/{servicename}.service.ts`
- Support files can be organized in: `/services/{servicename}/`

## Examples

### ✅ Correct Structure
```
/src/modules/core/users/services/
├── users.service.ts          # Main service file
└── users/                     # Optional support folder
    ├── validators.ts
    └── helpers.ts
```

```
/src/modules/core/dev/services/
├── dev.service.ts
├── type-generation.service.ts # Main service file  
├── type-generation/           # Support folder
│   ├── generators/
│   ├── parsers/
│   └── types.ts
└── validation.service.ts      # Main service file
```

### ❌ Incorrect Structure
```
/src/modules/core/users/services/
└── users/
    └── users.service.ts      # Service file inside folder - WRONG!
```

```
/src/modules/core/dev/services/
└── type-generation/
    └── type-generation.service.ts  # Service file inside folder - WRONG!
```

## Validation
The module validator checks for this convention:
- Service file must exist at: `/services/{modulename}.service.ts`
- This is enforced by the `dev validate --module {modulename}` command

## Rationale
- Consistent service discovery
- Clear module structure
- Easy imports: `import { UserService } from './services/users.service'`
- Support folders keep related code organized without hiding the main service