// OpenAPI description of the FitForge API, served by Swagger UI at /api/docs.
// Keep in step with src/routes and src/validators when endpoints change.

const { MUSCLE_GROUPS, EQUIPMENT } = require('../config/exercise');

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
    { name: 'Exercises', description: 'Built-in library plus each gym\'s own exercises' },
    { name: 'Plans', description: 'Workout plans: days of exercises, assigned to members' },
    { name: 'Sessions', description: 'Logged workouts, PRs, streaks and trainer reviews' },
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
      Exercise: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Barbell Bench Press' },
          muscleGroup: { type: 'string', enum: MUSCLE_GROUPS },
          equipment: { type: 'string', enum: EQUIPMENT },
          instructions: { type: 'string' },
          imageUrl: { type: 'string', nullable: true },
          isCustom: { type: 'boolean', description: 'true for exercises a gym added itself' },
        },
      },
      PlanExerciseInput: {
        type: 'object',
        required: ['exercise', 'sets', 'reps'],
        properties: {
          exercise: { type: 'string', description: 'Exercise id' },
          sets: { type: 'integer', minimum: 1, maximum: 10, example: 4 },
          reps: { type: 'string', example: '8-12', description: 'A number or a range' },
          weight: { type: 'number', nullable: true, example: 40, description: 'kg' },
          restSeconds: { type: 'integer', example: 90 },
          notes: { type: 'string', example: 'Pause at the bottom' },
        },
      },
      PlanInput: {
        type: 'object',
        required: ['name', 'days'],
        properties: {
          name: { type: 'string', example: 'Push Pull Legs' },
          description: { type: 'string', example: 'Three-day split' },
          days: {
            type: 'array',
            minItems: 1,
            maxItems: 7,
            items: {
              type: 'object',
              required: ['name', 'exercises'],
              properties: {
                name: { type: 'string', example: 'Push' },
                exercises: { type: 'array', minItems: 1, items: ref('PlanExerciseInput') },
              },
            },
          },
        },
      },
      WorkoutPlan: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          createdBy: ref('UserRef'),
          assignedTo: { type: 'array', items: ref('UserRef') },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                exercises: {
                  type: 'array',
                  items: {
                    allOf: [ref('PlanExerciseInput')],
                    properties: { exercise: ref('Exercise') },
                  },
                },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      LoggedSet: {
        type: 'object',
        required: ['reps'],
        properties: {
          reps: { type: 'integer', example: 10 },
          weight: { type: 'number', nullable: true, example: 40 },
          done: { type: 'boolean', example: true },
        },
      },
      WorkoutSession: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          member: ref('UserRef'),
          plan: { type: 'string' },
          planName: { type: 'string', example: 'Push Pull Legs' },
          dayIndex: { type: 'integer', example: 0 },
          dayName: { type: 'string', example: 'Push' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          durationSeconds: { type: 'integer', example: 2700 },
          totalVolume: { type: 'number', example: 4250, description: 'Sum of weight × reps over completed sets (kg)' },
          completedSets: { type: 'integer', example: 15 },
          notes: { type: 'string' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise: { type: 'string' },
                exerciseName: { type: 'string' },
                muscleGroup: { type: 'string' },
                target: { type: 'object', properties: { sets: { type: 'integer' }, reps: { type: 'string' }, weight: { type: 'number', nullable: true } } },
                sets: { type: 'array', items: ref('LoggedSet') },
              },
            },
          },
          prs: {
            type: 'array',
            items: { type: 'object', properties: { exercise: { type: 'string' }, exerciseName: { type: 'string' }, weight: { type: 'number' }, reps: { type: 'integer' } } },
          },
          review: {
            type: 'object',
            properties: {
              reviewedBy: { allOf: [ref('UserRef')], nullable: true },
              reviewedAt: { type: 'string', format: 'date-time', nullable: true },
              comment: { type: 'string' },
            },
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

    '/exercises': {
      get: {
        tags: ['Exercises'],
        summary: 'List exercises: the built-in library plus your gym\'s own',
        parameters: [
          { name: 'muscleGroup', in: 'query', schema: { type: 'string', enum: MUSCLE_GROUPS } },
          { name: 'q', in: 'query', description: 'Search by name', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Exercises', content: json({ type: 'object', properties: { exercises: { type: 'array', items: ref('Exercise') } } }) },
          401: unauthorized,
        },
      },
      post: {
        tags: ['Exercises'],
        summary: 'Add a custom exercise to your gym',
        description: 'Needs `workout:create` (trainers and owners).',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name', 'muscleGroup', 'equipment'],
            properties: {
              name: { type: 'string', example: 'Landmine Press' },
              muscleGroup: { type: 'string', enum: MUSCLE_GROUPS },
              equipment: { type: 'string', enum: EQUIPMENT },
              instructions: { type: 'string' },
            },
          }),
        },
        responses: {
          201: { description: 'Created', content: json({ type: 'object', properties: { exercise: ref('Exercise') } }) },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          409: errorResponse('An exercise with this name already exists'),
        },
      },
    },
    '/plans': {
      get: {
        tags: ['Plans'],
        summary: 'Workout plans you can see',
        description: 'Owners: every plan in the gym. Trainers: plans they created. Members: plans assigned to them.',
        responses: {
          200: { description: 'Plans', content: json({ type: 'object', properties: { plans: { type: 'array', items: ref('WorkoutPlan') } } }) },
          401: unauthorized,
        },
      },
      post: {
        tags: ['Plans'],
        summary: 'Create a workout plan',
        description: 'Needs `workout:create`.',
        requestBody: { required: true, content: json(ref('PlanInput')) },
        responses: { 201: { description: 'Created', content: json({ type: 'object', properties: { plan: ref('WorkoutPlan') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/plans/{id}': {
      get: {
        tags: ['Plans'],
        summary: 'One plan, with exercises filled in',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Plan', content: json({ type: 'object', properties: { plan: ref('WorkoutPlan') } }) }, 401: unauthorized, 404: errorResponse('Plan not found') },
      },
      put: {
        tags: ['Plans'],
        summary: 'Replace a plan\'s name, description and days',
        description: 'Needs `workout:create`. Trainers can edit their own plans; owners can edit any plan in the gym.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json(ref('PlanInput')) },
        responses: { 200: { description: 'Updated', content: json({ type: 'object', properties: { plan: ref('WorkoutPlan') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Plan not found') },
      },
      delete: {
        tags: ['Plans'],
        summary: 'Delete a plan',
        description: 'Needs `workout:create`. Same ownership rules as editing.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 401: unauthorized, 403: forbidden, 404: errorResponse('Plan not found') },
      },
    },
    '/plans/{id}/assignees': {
      put: {
        tags: ['Plans'],
        summary: 'Set which members follow this plan',
        description: 'Needs `workout:assign`. Replaces the whole list. Trainers can only assign their own clients.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['memberIds'], properties: { memberIds: { type: 'array', items: { type: 'string' } } } }),
        },
        responses: {
          200: { description: 'Updated', content: json({ type: 'object', properties: { plan: ref('WorkoutPlan') } }) },
          400: errorResponse('Validation failed, or a member is not yours to assign'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Plan not found'),
        },
      },
    },

    '/gym/join-code': {
      post: {
        tags: ['Gym'],
        summary: 'Replace the gym join code with a new one',
        description: 'Needs `gym:settings`. The old code stops working; existing members are not affected.',
        responses: {
          200: { description: 'Gym with the new code', content: json({ type: 'object', properties: { gym: ref('Gym') } }) },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/sessions': {
      post: {
        tags: ['Sessions'],
        summary: 'Save a finished workout',
        description:
          'Needs `workout:log` (members). The plan must be assigned to you and every exercise must belong to that day. The server works out duration, volume and personal records.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['planId', 'dayIndex', 'startedAt', 'entries'],
            properties: {
              planId: { type: 'string' },
              dayIndex: { type: 'integer', example: 0 },
              startedAt: { type: 'string', format: 'date-time' },
              notes: { type: 'string' },
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['exercise', 'sets'],
                  properties: { exercise: { type: 'string' }, sets: { type: 'array', items: ref('LoggedSet') } },
                },
              },
            },
          }),
        },
        responses: {
          201: { description: 'Saved', content: json({ type: 'object', properties: { session: ref('WorkoutSession') } }) },
          400: errorResponse('Validation failed, no completed sets, or exercise not in this day'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Plan not found or not assigned to you'),
        },
      },
      get: {
        tags: ['Sessions'],
        summary: 'Workout history',
        description: 'Members: their own. Trainers: their clients. Owners: the whole gym.',
        parameters: [
          { name: 'member', in: 'query', schema: { type: 'string' }, description: 'Only this member (must be in your scope)' },
          { name: 'pendingReview', in: 'query', schema: { type: 'boolean' }, description: 'Only sessions without a trainer review' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Sessions, newest first', content: json({ type: 'object', properties: { sessions: { type: 'array', items: ref('WorkoutSession') } } }) },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/sessions/summary': {
      get: {
        tags: ['Sessions'],
        summary: 'Streak, weekly activity, next day up and recent PRs for the signed-in member',
        description: 'Needs `workout:log`.',
        parameters: [
          { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset in minutes (Date#getTimezoneOffset)' },
        ],
        responses: {
          200: {
            description: 'Summary',
            content: json({
              type: 'object',
              properties: {
                summary: {
                  type: 'object',
                  properties: {
                    totalWorkouts: { type: 'integer' },
                    streak: { type: 'integer', description: 'Consecutive days with a workout' },
                    trainedToday: { type: 'boolean' },
                    week: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, count: { type: 'integer' }, volume: { type: 'number' } } } },
                    nextUp: { type: 'array', items: { type: 'object', properties: { planId: { type: 'string' }, dayIndex: { type: 'integer' } } } },
                    recentPrs: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            }),
          },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/sessions/previous': {
      get: {
        tags: ['Sessions'],
        summary: 'Your last logged sets for each exercise ("last time" hints)',
        description: 'Needs `workout:log`.',
        parameters: [
          { name: 'exercises', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated exercise ids (max 20)' },
        ],
        responses: {
          200: { description: 'Map of exercise id to its last sets', content: json({ type: 'object', properties: { previous: { type: 'object' } } }) },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/sessions/{id}': {
      get: {
        tags: ['Sessions'],
        summary: 'One logged workout',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Session', content: json({ type: 'object', properties: { session: ref('WorkoutSession') } }) }, 401: unauthorized, 403: forbidden, 404: errorResponse('Workout not found') },
      },
    },
    '/sessions/{id}/review': {
      patch: {
        tags: ['Sessions'],
        summary: 'Leave trainer feedback on a client workout',
        description: 'Needs `clients:read:assigned`. Trainers can review their own clients; owners anyone in the gym.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', required: ['comment'], properties: { comment: { type: 'string', example: 'Great depth on the squats — add 2.5 kg next time.' } } }) },
        responses: { 200: { description: 'Reviewed', content: json({ type: 'object', properties: { session: ref('WorkoutSession') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Workout not found') },
      },
    },
  },
};
