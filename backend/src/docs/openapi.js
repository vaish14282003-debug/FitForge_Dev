// OpenAPI description of the FitForge API, served by Swagger UI at /api/docs.
// Keep in step with src/routes and src/validators when endpoints change.

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const unauthorized = errorResponse('Not signed in, or the session expired');
const forbidden = errorResponse('Signed in, but this role lacks the permission');
const badRequest = errorResponse('Validation failed');

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'FitForge API',
    version: '1.0.0',
    description: [
      'Auth uses httpOnly cookies. To try protected endpoints here:',
      '',
      '1. Run **POST /auth/login** with one of the demo accounts (try it out → Execute).',
      '2. The browser stores the session cookie, and every later request on this page sends it.',
      '3. Run **POST /auth/logout** to switch accounts.',
      '',
      'Each endpoint lists the permission it needs. Roles map to permissions in `src/config/roles.js`.',
    ].join('\n'),
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Sign-up, login and session cookies' },
    { name: 'Users', description: 'Profile, team management and trainer clients' },
    { name: 'Gym', description: "The signed-in user's gym" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'ff_access' },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Role: { type: 'string', enum: ['SUPER_ADMIN', 'GYM_OWNER', 'TRAINER', 'STAFF', 'MEMBER'] },
      Permission: {
        type: 'string',
        enum: [
          'profile:read:own',
          'profile:update:own',
          'workout:create',
          'workout:assign',
          'clients:read:assigned',
          'members:manage',
          'trainers:manage',
          'revenue:read',
          'gym:settings',
        ],
      },
      UserRef: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6ac75434ee72ec477a5e224d' },
          name: { type: 'string', example: 'Vaishnavi Rao' },
          email: { type: 'string', format: 'email', example: 'member@fitforge.dev' },
          role: ref('Role'),
          gym: { type: 'string' },
          trainer: { allOf: [ref('UserRef')], nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Session: {
        type: 'object',
        properties: { user: ref('User'), permissions: { type: 'array', items: ref('Permission') } },
      },
      Gym: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Iron Temple' },
          owner: { type: 'string' },
          joinCode: {
            type: 'string',
            example: 'XSVYLDW4',
            description: 'Only returned to roles with gym:settings',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          details: {
            type: 'array',
            items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } },
          },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness check',
        security: [],
        responses: { 200: { description: 'API is up', content: json({ type: 'object', properties: { status: { type: 'string', example: 'ok' } } }) } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Sign up as a gym owner (creates a gym) or as a member (joins with a gym code)',
        description: 'Trainers and staff cannot self-register; an owner creates them via POST /users.',
        security: [],
        requestBody: {
          required: true,
          content: json({
            oneOf: [
              {
                title: 'Owner',
                type: 'object',
                required: ['name', 'email', 'password', 'role', 'gymName'],
                properties: {
                  name: { type: 'string', example: 'Asha Kapoor' },
                  email: { type: 'string', format: 'email', example: 'asha@example.com' },
                  password: { type: 'string', minLength: 8, maxLength: 72, example: 'Password123!' },
                  role: { type: 'string', enum: ['GYM_OWNER'] },
                  gymName: { type: 'string', example: 'Steel House' },
                },
              },
              {
                title: 'Member',
                type: 'object',
                required: ['name', 'email', 'password', 'role', 'gymCode'],
                properties: {
                  name: { type: 'string', example: 'Rahul Jain' },
                  email: { type: 'string', format: 'email', example: 'rahul@example.com' },
                  password: { type: 'string', minLength: 8, maxLength: 72, example: 'Password123!' },
                  role: { type: 'string', enum: ['MEMBER'] },
                  gymCode: { type: 'string', minLength: 8, maxLength: 8, example: 'XSVYLDW4' },
                },
              },
            ],
          }),
        },
        responses: {
          201: { description: 'Account created and session cookies set', content: json(ref('Session')) },
          400: errorResponse('Validation failed, or no gym uses that code'),
          409: errorResponse('Email already registered'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive session cookies',
        security: [],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email', example: 'owner@fitforge.dev' },
              password: { type: 'string', example: 'Password123!' },
            },
          }),
        },
        responses: {
          200: { description: 'Signed in; ff_access, ff_refresh and ff_session cookies set', content: json(ref('Session')) },
          400: badRequest,
          401: errorResponse('Incorrect email or password'),
          403: errorResponse('Account deactivated'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh token and issue a new access token',
        description: 'Uses the ff_refresh cookie. Each refresh token works once; replaying an old one revokes all sessions for that user.',
        security: [],
        responses: { 200: { description: 'New cookies set', content: json(ref('Session')) }, 401: unauthorized },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the refresh token and clear cookies',
        security: [],
        responses: { 204: { description: 'Signed out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user and their permissions',
        responses: { 200: { description: 'Session', content: json(ref('Session')) }, 401: unauthorized },
      },
    },
    '/users/me': {
      patch: {
        tags: ['Users'],
        summary: 'Update your own profile',
        description: 'Needs `profile:update:own` (every role). Role and gym cannot be changed here.',
        requestBody: {
          required: true,
          content: json({ type: 'object', properties: { name: { type: 'string', example: 'Vaishnavi R.' } } }),
        },
        responses: {
          200: { description: 'Updated', content: json({ type: 'object', properties: { user: ref('User') } }) },
          400: badRequest,
          401: unauthorized,
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List people in your gym',
        description:
          'Needs `members:manage` and/or `trainers:manage`. Owners see members, trainers and staff; staff see members only.',
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['MEMBER', 'TRAINER', 'STAFF'] } },
        ],
        responses: {
          200: { description: 'Users', content: json({ type: 'object', properties: { users: { type: 'array', items: ref('User') } } }) },
          401: unauthorized,
          403: forbidden,
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a member, trainer or staff account in your gym',
        description: 'Creating members needs `members:manage`; trainers and staff need `trainers:manage`.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name', 'email', 'password', 'role'],
            properties: {
              name: { type: 'string', example: 'Kabir Singh' },
              email: { type: 'string', format: 'email', example: 'kabir@example.com' },
              password: { type: 'string', minLength: 8, maxLength: 72, example: 'Password123!' },
              role: { type: 'string', enum: ['MEMBER', 'TRAINER', 'STAFF'] },
            },
          }),
        },
        responses: {
          201: { description: 'Created', content: json({ type: 'object', properties: { user: ref('User') } }) },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          409: errorResponse('Email already registered'),
        },
      },
    },
    '/users/clients': {
      get: {
        tags: ['Users'],
        summary: 'Members assigned to a trainer',
        description: 'Needs `clients:read:assigned`. Trainers see only their own clients; owners see every assigned member.',
        responses: {
          200: { description: 'Clients', content: json({ type: 'object', properties: { clients: { type: 'array', items: ref('User') } } }) },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/users/{id}/trainer': {
      patch: {
        tags: ['Users'],
        summary: 'Assign a trainer to a member (or unassign with null)',
        description: 'Needs `members:manage`. Both people must belong to your gym.',
        parameters: [{ name: 'id', in: 'path', required: true, description: 'Member id', schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['trainerId'],
            properties: { trainerId: { type: 'string', nullable: true } },
          }),
        },
        responses: {
          200: { description: 'Updated member', content: json({ type: 'object', properties: { user: ref('User') } }) },
          400: errorResponse('Validation failed, or trainer not in this gym'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Member not found in this gym'),
        },
      },
    },
    '/gym': {
      get: {
        tags: ['Gym'],
        summary: 'Your gym',
        description: 'Any signed-in user. The join code is included only for roles with `gym:settings`.',
        responses: {
          200: { description: 'Gym', content: json({ type: 'object', properties: { gym: ref('Gym') } }) },
          401: unauthorized,
        },
      },
    },
    '/gym/lookup': {
      get: {
        tags: ['Gym'],
        summary: 'Check a gym join code before signing up',
        description: 'Public. Returns only the gym name, so the sign-up form can confirm the code. Rate-limited.',
        security: [],
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string', minLength: 8, maxLength: 8, example: 'MB2NHVEE' } },
        ],
        responses: {
          200: {
            description: 'Code belongs to a gym',
            content: json({ type: 'object', properties: { gym: { type: 'object', properties: { name: { type: 'string', example: 'Iron Temple' } } } } }),
          },
          400: badRequest,
          404: errorResponse('No gym uses that code'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/gym/overview': {
      get: {
        tags: ['Gym'],
        summary: 'Head counts for the owner dashboard',
        description: 'Needs `members:manage` and `trainers:manage`.',
        responses: {
          200: {
            description: 'Counts of active accounts',
            content: json({
              type: 'object',
              properties: {
                overview: {
                  type: 'object',
                  properties: { members: { type: 'integer' }, trainers: { type: 'integer' }, staff: { type: 'integer' } },
                },
              },
            }),
          },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
  },
};
