// OpenAPI description of the FitForge API, served by Swagger UI at /api/docs.
// Keep in step with src/routes and src/validators when endpoints change.

const { MUSCLE_GROUPS, EQUIPMENT } = require('../config/exercise');
const { MUSCLE_IDS, MOVEMENT_PATTERNS } = require('../config/anatomy');

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
    { name: 'Progress', description: 'Body weight and measurements, goals, strength and volume over time' },
    { name: 'Memberships', description: 'Plans and prices, selling and renewing memberships, payments and revenue' },
    { name: 'Schedule', description: 'Trainer hours, 1-on-1 session booking, and group classes' },
    { name: 'Notifications', description: 'In-app alerts, announcements and trainer messages' },
    { name: 'Clients', description: "Trainers' private notes about clients" },
    { name: 'Resources', description: 'Files trainers share with clients (PDFs, images)' },
    { name: 'Nutrition', description: 'Nutrition goals and a daily food and water log' },
    { name: 'Reports', description: 'Owner CSV exports and trainer performance' },
    { name: 'Files', description: 'Uploaded images, served only within the owning gym' },
    { name: 'Attendance', description: 'Front-desk QR check-in, manual check-in, visit history and daily counts' },
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
          avatarUrl: { type: 'string', nullable: true, example: '/api/files/gyms/…/avatars/….webp' },
          phone: { type: 'string', example: '+91 98765 43210' },
          bio: { type: 'string' },
          heightCm: { type: 'integer', nullable: true, example: 168 },
          dateOfBirth: { type: 'string', nullable: true, example: '1999-04-12' },
          fitnessGoal: { type: 'string', nullable: true, enum: ['LOSE_WEIGHT', 'BUILD_MUSCLE', 'GET_STRONGER', 'IMPROVE_FITNESS', 'STAY_HEALTHY'] },
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
          movementPattern: { type: 'string', nullable: true, enum: MOVEMENT_PATTERNS },
          primaryMuscles: { type: 'array', items: { type: 'string', enum: MUSCLE_IDS }, description: 'Prime movers' },
          secondaryMuscles: { type: 'array', items: { type: 'string', enum: MUSCLE_IDS }, description: 'Assisting muscles' },
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
      BodyMetric: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          day: { type: 'string', example: '2026-10-23' },
          weight: { type: 'number', nullable: true, example: 62.4 },
          bodyFat: { type: 'number', nullable: true, example: 22.5 },
          measurements: {
            type: 'object',
            properties: {
              chest: { type: 'number', nullable: true },
              waist: { type: 'number', nullable: true },
              hips: { type: 'number', nullable: true },
              arm: { type: 'number', nullable: true },
              thigh: { type: 'number', nullable: true },
            },
          },
          note: { type: 'string' },
        },
      },
      Attendance: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          member: { type: 'string' },
          day: { type: 'string', example: '2026-10-23' },
          checkedInAt: { type: 'string', format: 'date-time' },
          method: { type: 'string', enum: ['QR', 'STAFF'] },
        },
      },
      MembershipPlan: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Quarterly' },
          durationMonths: { type: 'integer', example: 3 },
          price: { type: 'integer', example: 4000, description: 'Whole rupees' },
          description: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      Payment: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PAID', 'PENDING'] },
          method: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'BANK', 'OTHER'], nullable: true, description: 'Required when PAID' },
          reference: { type: 'string', example: 'UPI ref 4821' },
        },
      },
      Membership: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          member: { type: 'string' },
          plan: { type: 'string' },
          planName: { type: 'string', example: 'Quarterly' },
          durationMonths: { type: 'integer' },
          price: { type: 'integer' },
          startDate: { type: 'string', example: '2026-10-01' },
          endDate: { type: 'string', example: '2026-12-31' },
          status: { type: 'string', enum: ['UPCOMING', 'ACTIVE', 'EXPIRED', 'CANCELLED'] },
          daysLeft: { type: 'integer', nullable: true },
          payment: { allOf: [ref('Payment')], properties: { paidAt: { type: 'string', format: 'date-time', nullable: true } } },
          renewalOf: { type: 'string', nullable: true },
          cancelledAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          trainer: ref('UserRef'),
          member: ref('UserRef'),
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'] },
          notes: { type: 'string' },
        },
      },
      GymClass: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', example: 'HIIT Blast' },
          description: { type: 'string' },
          location: { type: 'string', example: 'Studio 1' },
          trainer: { allOf: [ref('UserRef')], nullable: true },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          capacity: { type: 'integer', example: 12 },
          spotsLeft: { type: 'integer', example: 4 },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Member ids' },
          cancelledAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['PLAN_ASSIGNED', 'WORKOUT_REVIEWED', 'BOOKING_CREATED', 'BOOKING_CANCELLED', 'CLASS_CANCELLED', 'MEMBERSHIP_ADDED', 'MEMBERSHIP_EXPIRING', 'ANNOUNCEMENT', 'MESSAGE', 'RESOURCE_SHARED'] },
          title: { type: 'string' },
          body: { type: 'string', description: 'For booking and class alerts, an ISO time the app formats locally' },
          link: { type: 'string', nullable: true, example: '/schedule' },
          actor: { allOf: [ref('UserRef')], nullable: true },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Announcement: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', example: 'Closed on Diwali' },
          body: { type: 'string' },
          audience: { type: 'string', enum: ['EVERYONE', 'MEMBERS', 'TRAINERS', 'STAFF'] },
          pinned: { type: 'boolean' },
          author: ref('UserRef'),
          createdAt: { type: 'string', format: 'date-time' },
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
        description: 'Needs `profile:update:own` (every role). Role, email and gym cannot be changed here.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Vaishnavi R.' },
              phone: { type: 'string', example: '+91 98765 43210' },
              bio: { type: 'string', example: 'Strength coach, 6 years' },
              heightCm: { type: 'integer', nullable: true, example: 168 },
              dateOfBirth: { type: 'string', nullable: true, example: '1999-04-12' },
              fitnessGoal: { type: 'string', nullable: true, enum: ['LOSE_WEIGHT', 'BUILD_MUSCLE', 'GET_STRONGER', 'IMPROVE_FITNESS', 'STAY_HEALTHY'] },
            },
          }),
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
          { name: 'muscle', in: 'query', description: 'Only exercises that train this muscle (primary or secondary)', schema: { type: 'string', enum: MUSCLE_IDS } },
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

    '/progress/metrics': {
      get: {
        tags: ['Progress'],
        summary: 'Weigh-ins and measurements, oldest first, plus the weight goal',
        description: 'Members: their own. Trainers: a client via ?member=. Owners: any member.',
        parameters: [{ name: 'member', in: 'query', schema: { type: 'string' }, description: 'Trainers/owners: which member (required for them)' }],
        responses: {
          200: {
            description: 'Metrics',
            content: json({
              type: 'object',
              properties: {
                member: ref('UserRef'),
                goal: { type: 'object', properties: { targetWeight: { type: 'number', nullable: true } } },
                metrics: { type: 'array', items: ref('BodyMetric') },
              },
            }),
          },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Member not found or not yours'),
        },
      },
      put: {
        tags: ['Progress'],
        summary: 'Log weight, body fat or measurements for a day (updates that day if it exists)',
        description: 'Needs `workout:log` (members).',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['day'],
            properties: {
              day: { type: 'string', example: '2026-10-23' },
              weight: { type: 'number', example: 62.4 },
              bodyFat: { type: 'number', example: 22.5 },
              measurements: { type: 'object', properties: { waist: { type: 'number', example: 72 } } },
              note: { type: 'string' },
            },
          }),
        },
        responses: {
          200: { description: 'Saved', content: json({ type: 'object', properties: { metric: ref('BodyMetric') } }) },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/progress/metrics/{id}': {
      delete: {
        tags: ['Progress'],
        summary: 'Delete one of your entries',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 401: unauthorized, 403: forbidden, 404: errorResponse('Entry not found') },
      },
    },
    '/progress/goal': {
      put: {
        tags: ['Progress'],
        summary: 'Set or clear your target body weight',
        requestBody: { required: true, content: json({ type: 'object', required: ['targetWeight'], properties: { targetWeight: { type: 'number', nullable: true, example: 60 } } }) },
        responses: {
          200: { description: 'Saved', content: json({ type: 'object', properties: { goal: { type: 'object' } } }) },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/progress/training': {
      get: {
        tags: ['Progress'],
        summary: 'Weekly workouts and volume, and every exercise logged with its best weight',
        parameters: [
          { name: 'member', in: 'query', schema: { type: 'string' }, description: 'Trainers/owners: which member (required for them)' },
          { name: 'weeks', in: 'query', schema: { type: 'integer', default: 12, minimum: 4, maximum: 52 } },
          { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' },
        ],
        responses: {
          200: {
            description: 'Training summary',
            content: json({
              type: 'object',
              properties: {
                weekly: { type: 'array', items: { type: 'object', properties: { weekStart: { type: 'string' }, workouts: { type: 'integer' }, volume: { type: 'number' } } } },
                exercises: { type: 'array', items: { type: 'object', properties: { exercise: { type: 'string' }, name: { type: 'string' }, muscleGroup: { type: 'string' }, sessions: { type: 'integer' }, bestWeight: { type: 'number', nullable: true } } } },
              },
            }),
          },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Member not found or not yours'),
        },
      },
    },
    '/progress/strength': {
      get: {
        tags: ['Progress'],
        summary: 'One exercise over time: best weight and estimated 1-rep max per session',
        description: 'Estimated 1RM uses the Epley formula, weight × (1 + reps / 30).',
        parameters: [{ name: 'member', in: 'query', schema: { type: 'string' }, description: 'Trainers/owners: which member (required for them)' }, { name: 'exercise', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Series',
            content: json({
              type: 'object',
              properties: {
                exercise: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
                points: { type: 'array', items: { type: 'object', properties: { date: { type: 'string', format: 'date-time' }, bestWeight: { type: 'number', nullable: true }, e1rm: { type: 'number', nullable: true }, reps: { type: 'integer' }, volume: { type: 'number' } } } },
              },
            }),
          },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          404: errorResponse('No logged sets for this exercise, or member not yours'),
        },
      },
    },

    '/attendance/qr': {
      get: {
        tags: ['Attendance'],
        summary: 'A short-lived check-in token for the front-desk QR code',
        description: 'Needs `members:manage` (owners, staff). Valid for 2 minutes; the screen refreshes it every minute.',
        responses: {
          200: {
            description: 'Token',
            content: json({ type: 'object', properties: { token: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, ttlSeconds: { type: 'integer', example: 120 } } }),
          },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/attendance/check-in': {
      post: {
        tags: ['Attendance'],
        summary: 'Check yourself in with a scanned front-desk code',
        description: 'Needs `workout:log` (members). One visit per day: a second scan returns the existing visit with `alreadyCheckedIn: true`.',
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['token'], properties: { token: { type: 'string' }, tz: { type: 'integer', example: -330 } } }),
        },
        responses: {
          201: { description: 'Checked in', content: json({ type: 'object', properties: { attendance: ref('Attendance'), alreadyCheckedIn: { type: 'boolean' } } }) },
          200: { description: 'Already checked in today', content: json({ type: 'object', properties: { attendance: ref('Attendance'), alreadyCheckedIn: { type: 'boolean' } } }) },
          400: errorResponse('Code expired, invalid, or for another gym'),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/attendance': {
      post: {
        tags: ['Attendance'],
        summary: 'Check a member in from the front desk',
        description: 'Needs `members:manage`.',
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['memberId'], properties: { memberId: { type: 'string' }, tz: { type: 'integer', example: -330 } } }),
        },
        responses: {
          201: { description: 'Checked in', content: json({ type: 'object', properties: { attendance: ref('Attendance'), alreadyCheckedIn: { type: 'boolean' } } }) },
          200: { description: 'Already checked in today', content: json({ type: 'object', properties: { attendance: ref('Attendance'), alreadyCheckedIn: { type: 'boolean' } } }) },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Member not found in this gym'),
        },
      },
    },
    '/attendance/summary': {
      get: {
        tags: ['Attendance'],
        summary: "A member's visits: today, this month, last 30 days, and the days visited in the last 12 weeks",
        description: 'Members: their own. Trainers: a client via ?member=. Owners and staff: any member.',
        parameters: [
          { name: 'member', in: 'query', schema: { type: 'string' } },
          { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' },
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
                    checkedInToday: { type: 'boolean' },
                    todayAt: { type: 'string', format: 'date-time', nullable: true },
                    thisMonth: { type: 'integer' },
                    last30Days: { type: 'integer' },
                    total: { type: 'integer' },
                    days: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            }),
          },
          400: badRequest,
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Member not found or not yours'),
        },
      },
    },
    '/attendance/stats': {
      get: {
        tags: ['Attendance'],
        summary: "Gym check-ins per day, plus today's list",
        description: 'Needs `members:manage`.',
        parameters: [{ name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' }, { name: 'days', in: 'query', schema: { type: 'integer', default: 14, minimum: 7, maximum: 60 } }],
        responses: {
          200: {
            description: 'Stats',
            content: json({
              type: 'object',
              properties: {
                stats: {
                  type: 'object',
                  properties: {
                    today: { type: 'integer' },
                    daily: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, count: { type: 'integer' } } } },
                    checkIns: { type: 'array', items: ref('Attendance') },
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

    '/membership-plans': {
      get: {
        tags: ['Memberships'],
        summary: "The gym's membership plans",
        description: 'Members see plans on sale; owners and staff also see archived ones.',
        responses: { 200: { description: 'Plans', content: json({ type: 'object', properties: { plans: { type: 'array', items: ref('MembershipPlan') } } }) }, 401: unauthorized },
      },
      post: {
        tags: ['Memberships'],
        summary: 'Create a plan',
        description: 'Needs `gym:settings` (owners).',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name', 'durationMonths', 'price'],
            properties: { name: { type: 'string', example: 'Quarterly' }, durationMonths: { type: 'integer', example: 3 }, price: { type: 'integer', example: 4000 }, description: { type: 'string' } },
          }),
        },
        responses: { 201: { description: 'Created', content: json({ type: 'object', properties: { plan: ref('MembershipPlan') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/membership-plans/{id}': {
      patch: {
        tags: ['Memberships'],
        summary: 'Rename, reprice or archive a plan',
        description: 'Needs `gym:settings`. Existing memberships keep the price they were sold at.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', properties: { name: { type: 'string' }, price: { type: 'integer' }, description: { type: 'string' }, isActive: { type: 'boolean' } } }) },
        responses: { 200: { description: 'Updated', content: json({ type: 'object', properties: { plan: ref('MembershipPlan') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Plan not found') },
      },
    },
    '/memberships': {
      get: {
        tags: ['Memberships'],
        summary: 'Membership history, newest first',
        description: 'Needs `memberships:manage` (owners, staff).',
        parameters: [{ name: 'member', in: 'query', schema: { type: 'string' } }, { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' }],
        responses: { 200: { description: 'Memberships', content: json({ type: 'object', properties: { memberships: { type: 'array', items: ref('Membership') } } }) }, 401: unauthorized, 403: forbidden },
      },
      post: {
        tags: ['Memberships'],
        summary: 'Sell a membership to a member',
        description: 'Needs `memberships:manage`. Starts today unless startDate is given; must not overlap another live membership.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['memberId', 'planId', 'payment'],
            properties: { memberId: { type: 'string' }, planId: { type: 'string' }, startDate: { type: 'string', example: '2026-10-23' }, payment: ref('Payment'), notes: { type: 'string' }, tz: { type: 'integer' } },
          }),
        },
        responses: {
          201: { description: 'Sold', content: json({ type: 'object', properties: { membership: ref('Membership') } }) },
          400: errorResponse('Validation failed, or plan archived'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Member or plan not found'),
          409: errorResponse('Overlaps an existing membership'),
        },
      },
    },
    '/memberships/{id}/renew': {
      post: {
        tags: ['Memberships'],
        summary: "Renew: a new period starting the day after the member's latest one ends (or today if lapsed)",
        description: 'Needs `memberships:manage`. Uses the same plan unless planId is given.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', required: ['payment'], properties: { planId: { type: 'string' }, payment: ref('Payment'), notes: { type: 'string' }, tz: { type: 'integer' } } }) },
        responses: { 201: { description: 'Renewed', content: json({ type: 'object', properties: { membership: ref('Membership') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Membership not found') },
      },
    },
    '/memberships/{id}/payment': {
      patch: {
        tags: ['Memberships'],
        summary: 'Record payment for a pending membership',
        description: 'Needs `memberships:manage`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', required: ['method'], properties: { method: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'BANK', 'OTHER'] }, reference: { type: 'string' } } }) },
        responses: { 200: { description: 'Paid', content: json({ type: 'object', properties: { membership: ref('Membership') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Membership not found'), 409: errorResponse('Already paid') },
      },
    },
    '/memberships/{id}/cancel': {
      post: {
        tags: ['Memberships'],
        summary: 'Cancel a membership',
        description: 'Needs `memberships:manage`. Cancelled memberships no longer count as active or towards revenue.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cancelled', content: json({ type: 'object', properties: { membership: ref('Membership') } }) }, 401: unauthorized, 403: forbidden, 404: errorResponse('Membership not found') },
      },
    },
    '/memberships/roster': {
      get: {
        tags: ['Memberships'],
        summary: 'Every member with their membership standing',
        description: 'Needs `memberships:manage`. Status is ACTIVE, EXPIRING (within 7 days, nothing booked after), UPCOMING, EXPIRED or NONE.',
        parameters: [{ name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' }],
        responses: {
          200: {
            description: 'Roster',
            content: json({
              type: 'object',
              properties: {
                roster: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      member: ref('UserRef'),
                      status: { type: 'string', enum: ['ACTIVE', 'EXPIRING', 'UPCOMING', 'EXPIRED', 'NONE'] },
                      current: { allOf: [ref('Membership')], nullable: true },
                      upcoming: { allOf: [ref('Membership')], nullable: true },
                      latest: { allOf: [ref('Membership')], nullable: true },
                      pendingPayments: { type: 'integer' },
                    },
                  },
                },
                expiringDays: { type: 'integer', example: 7 },
              },
            }),
          },
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/memberships/overview': {
      get: {
        tags: ['Memberships'],
        summary: 'Active members, memberships expiring soon, pending payments, and (owners) revenue',
        description: 'Needs `memberships:manage`. The revenue block is included only with `revenue:read`.',
        parameters: [{ name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' }],
        responses: { 200: { description: 'Overview', content: json({ type: 'object', properties: { overview: { type: 'object' } } }) }, 401: unauthorized, 403: forbidden },
      },
    },
    '/memberships/me': {
      get: {
        tags: ['Memberships'],
        summary: 'Your membership: current, upcoming, and history',
        description: 'Needs `workout:log` (members).',
        parameters: [{ name: 'tz', in: 'query', schema: { type: 'integer', example: -330 }, description: 'Browser timezone offset (minutes)' }],
        responses: { 200: { description: 'Your membership', content: json({ type: 'object', properties: { status: { type: 'string' }, current: { allOf: [ref('Membership')], nullable: true }, history: { type: 'array', items: ref('Membership') } } }) }, 401: unauthorized, 403: forbidden },
      },
    },

    '/users/me/avatar': {
      post: {
        tags: ['Users'],
        summary: 'Upload or replace your profile photo',
        description: 'JPG, PNG or WebP up to 5 MB. Cropped to a 512 px square and stored as WebP; metadata (e.g. GPS) is removed.',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', required: ['avatar'], properties: { avatar: { type: 'string', format: 'binary', description: 'Image file' } } } } },
        },
        responses: { 200: { description: 'Updated', content: json({ type: 'object', properties: { user: ref('User') } }) }, 400: errorResponse('Not an image, wrong type, or over 5 MB'), 401: unauthorized },
      },
      delete: {
        tags: ['Users'],
        summary: 'Remove your profile photo',
        responses: { 200: { description: 'Removed', content: json({ type: 'object', properties: { user: ref('User') } }) }, 401: unauthorized },
      },
    },
    '/users/me/password': {
      post: {
        tags: ['Users'],
        summary: 'Change your password',
        description: 'Signs out all other devices; this one gets a fresh session.',
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8, maxLength: 72 } } }),
        },
        responses: { 204: { description: 'Changed' }, 400: errorResponse('Current password wrong, or new password invalid'), 401: unauthorized },
      },
    },
    '/exercises/{id}/image': {
      post: {
        tags: ['Exercises'],
        summary: "Add or replace a photo on one of your gym's own exercises",
        description: 'Needs `workout:create`. Built-in library exercises cannot be changed.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', required: ['image'], properties: { image: { type: 'string', format: 'binary', description: 'Image file, up to 5 MB' } } } } },
        },
        responses: {
          200: { description: 'Updated', content: json({ type: 'object', properties: { exercise: ref('Exercise') } }) },
          400: errorResponse('Not an image, wrong type, or over 5 MB'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse("Not one of your gym's exercises"),
        },
      },
    },
    '/files/{key}': {
      get: {
        tags: ['Files'],
        summary: 'An uploaded file (profile photo, exercise image)',
        description:
          'Only for people signed in to the gym the file belongs to. With local storage the file is returned directly; with S3 the response redirects to a signed link valid for 5 minutes. Use the avatarUrl/imageUrl values the API returns rather than building keys.',
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' }, description: 'Storage key, e.g. gyms/<gymId>/avatars/<id>.webp' }],
        responses: { 200: { description: 'The file' }, 302: { description: 'Redirect to a signed S3 link' }, 401: unauthorized, 404: errorResponse('File not found or not in your gym') },
      },
    },

    '/schedule/availability': {
      get: {
        tags: ['Schedule'],
        summary: "A trainer's weekly hours",
        description: "Members get their own trainer's; trainers their own; owners pass ?trainer=.",
        parameters: [{ name: 'trainer', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Availability', content: json({ type: 'object', properties: { availability: { type: 'object', properties: { weekly: { type: 'array', items: { type: 'object', properties: { day: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Sunday' }, start: { type: 'string', example: '07:00' }, end: { type: 'string', example: '11:00' } } } }, sessionMinutes: { type: 'integer', enum: [30, 45, 60, 90] } } }, trainer: ref('UserRef') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
      put: {
        tags: ['Schedule'],
        summary: 'Set your weekly hours (trainers)',
        description: 'Times are the gym\'s local time. Blocks on the same day must not overlap.',
        requestBody: { required: true, content: json({ type: 'object', required: ['weekly', 'sessionMinutes'], properties: { weekly: { type: 'array', items: { type: 'object', properties: { day: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Sunday' }, start: { type: 'string', example: '07:00' }, end: { type: 'string', example: '11:00' } } } }, sessionMinutes: { type: 'integer', enum: [30, 45, 60, 90] } } }) },
        responses: { 200: { description: 'Saved' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/schedule/slots': {
      get: {
        tags: ['Schedule'],
        summary: 'Open and taken session slots for the next days',
        parameters: [
          { name: 'trainer', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', example: '2026-10-24' } },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 7, maximum: 21 } },
          { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 } },
        ],
        responses: { 200: { description: 'Slots by day' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/schedule/bookings': {
      get: {
        tags: ['Schedule'],
        summary: '1-on-1 sessions in a date range',
        description: 'Members: their own. Trainers: theirs. Owners: the whole gym.',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'member', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Bookings', content: json({ type: 'object', properties: { bookings: { type: 'array', items: ref('Booking') } } }) }, 401: unauthorized, 403: forbidden },
      },
      post: {
        tags: ['Schedule'],
        summary: 'Book a session',
        description: 'Members book their own trainer; trainers book one of their clients (memberId). The time must be one of the trainer\'s slots and free.',
        requestBody: { required: true, content: json({ type: 'object', required: ['startsAt'], properties: { startsAt: { type: 'string', format: 'date-time' }, memberId: { type: 'string' }, notes: { type: 'string' }, tz: { type: 'integer' } } }) },
        responses: { 201: { description: 'Booked', content: json({ type: 'object', properties: { booking: ref('Booking') } }) }, 400: errorResponse('Not an available slot, or in the past'), 401: unauthorized, 403: forbidden, 409: errorResponse('Slot just taken, or a clash') },
      },
    },
    '/schedule/bookings/{id}/cancel': {
      post: {
        tags: ['Schedule'],
        summary: 'Cancel a booked session before it starts',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cancelled', content: json({ type: 'object', properties: { booking: ref('Booking') } }) }, 400: badRequest, 401: unauthorized, 404: errorResponse('Session not found'), 409: errorResponse('Not booked') },
      },
    },
    '/schedule/bookings/{id}/status': {
      patch: {
        tags: ['Schedule'],
        summary: 'Mark a session completed or no-show (trainers, owners)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['COMPLETED', 'NO_SHOW'] } } }) },
        responses: { 200: { description: 'Updated', content: json({ type: 'object', properties: { booking: ref('Booking') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Session not found') },
      },
    },
    '/schedule/classes': {
      get: {
        tags: ['Schedule'],
        summary: 'Group classes (from yesterday onward unless from= is given)',
        parameters: [{ name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }],
        responses: { 200: { description: 'Classes', content: json({ type: 'object', properties: { classes: { type: 'array', items: ref('GymClass') } } }) }, 401: unauthorized },
      },
      post: {
        tags: ['Schedule'],
        summary: 'Create a class, optionally repeating weekly',
        description: 'Needs `workout:create` (trainers, owners).',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['title', 'startsAt', 'durationMinutes', 'capacity'],
            properties: {
              title: { type: 'string', example: 'HIIT Blast' },
              description: { type: 'string' },
              location: { type: 'string', example: 'Studio 1' },
              trainerId: { type: 'string', nullable: true },
              startsAt: { type: 'string', format: 'date-time' },
              durationMinutes: { type: 'integer', example: 45 },
              capacity: { type: 'integer', example: 12 },
              repeatWeeks: { type: 'integer', example: 4, description: 'How many weekly occurrences to create' },
            },
          }),
        },
        responses: { 201: { description: 'Created', content: json({ type: 'object', properties: { classes: { type: 'array', items: ref('GymClass') } } }) }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/schedule/classes/{id}/join': {
      post: {
        tags: ['Schedule'],
        summary: 'Join a class (members)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Joined', content: json({ type: 'object', properties: { class: ref('GymClass') } }) }, 400: errorResponse('Already started'), 401: unauthorized, 403: forbidden, 404: errorResponse('Class not found'), 409: errorResponse('Full, cancelled, or already joined') },
      },
    },
    '/schedule/classes/{id}/leave': {
      post: {
        tags: ['Schedule'],
        summary: 'Leave a class before it starts (members)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Left', content: json({ type: 'object', properties: { class: ref('GymClass') } }) }, 401: unauthorized, 403: forbidden, 404: errorResponse('Class not found or started') },
      },
    },
    '/schedule/classes/{id}/cancel': {
      post: {
        tags: ['Schedule'],
        summary: 'Cancel a class (its trainer, creator, or the owner)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cancelled', content: json({ type: 'object', properties: { class: ref('GymClass') } }) }, 401: unauthorized, 403: forbidden, 404: errorResponse('Class not found') },
      },
    },

    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Your alerts, newest first, with the unread count',
        description: 'Members also get a one-off "membership ends in N days" alert inside the last 3 days.',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 30 } }, { name: 'tz', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'Alerts', content: json({ type: 'object', properties: { notifications: { type: 'array', items: ref('Notification') }, unread: { type: 'integer' } } }) }, 401: unauthorized },
      },
    },
    '/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'How many unread alerts you have (for the bell badge)',
        responses: { 200: { description: 'Count', content: json({ type: 'object', properties: { unread: { type: 'integer' } } }) }, 401: unauthorized },
      },
    },
    '/notifications/read-all': {
      post: { tags: ['Notifications'], summary: 'Mark every alert read', responses: { 200: { description: 'Done' }, 401: unauthorized } },
    },
    '/notifications/{id}/read': {
      post: { tags: ['Notifications'], summary: 'Mark one alert read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Done' }, 401: unauthorized, 404: errorResponse('Not found') } },
    },
    '/notifications/messages': {
      post: {
        tags: ['Notifications'],
        summary: 'Send a message to members',
        description: 'Needs `clients:read:assigned`. Trainers can message only their own clients; owners anyone in the gym.',
        requestBody: { required: true, content: json({ type: 'object', required: ['memberIds', 'title'], properties: { memberIds: { type: 'array', items: { type: 'string' } }, title: { type: 'string' }, body: { type: 'string' } } }) },
        responses: { 201: { description: 'Sent' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/announcements': {
      get: {
        tags: ['Notifications'],
        summary: 'Announcements for your role, pinned first',
        responses: { 200: { description: 'Announcements', content: json({ type: 'object', properties: { announcements: { type: 'array', items: ref('Announcement') } } }) }, 401: unauthorized },
      },
      post: {
        tags: ['Notifications'],
        summary: 'Post an announcement (owners); everyone in the audience gets an alert',
        requestBody: { required: true, content: json({ type: 'object', required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' }, audience: { type: 'string', enum: ['EVERYONE', 'MEMBERS', 'TRAINERS', 'STAFF'] }, pinned: { type: 'boolean' } } }) },
        responses: { 201: { description: 'Posted' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/announcements/{id}': {
      delete: { tags: ['Notifications'], summary: 'Delete an announcement (owners)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted' }, 401: unauthorized, 403: forbidden, 404: errorResponse('Not found') } },
    },

    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Email a password reset link',
        description: 'Always returns the same message, whether or not the email has an account. The link works once, for 30 minutes.',
        security: [],
        requestBody: { required: true, content: json({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }) },
        responses: { 200: { description: 'Request accepted' }, 400: badRequest, 429: errorResponse('Too many attempts') },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Set a new password with a reset token',
        description: 'Signs out every existing session.',
        security: [],
        requestBody: { required: true, content: json({ type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8, maxLength: 72 } } }) },
        responses: { 200: { description: 'Password updated' }, 400: errorResponse('Invalid or expired link'), 429: errorResponse('Too many attempts') },
      },
    },
    '/users/{id}': {
      patch: {
        tags: ['Users'],
        summary: 'Edit or (de)activate someone you manage',
        description: 'Owners: members, trainers, staff. Staff: members. Deactivating signs them out everywhere; a deactivated trainer\'s clients are unassigned.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, isActive: { type: 'boolean' } } }) },
        responses: { 200: { description: 'Updated', content: json({ type: 'object', properties: { user: ref('User') } }) }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Person not found') },
      },
    },
    '/clients/{id}/notes': {
      get: {
        tags: ['Clients'],
        summary: "Private notes about a client (never shown to the member)",
        description: 'Trainers: their own clients. Owners: any member.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notes, newest first' }, 401: unauthorized, 403: forbidden, 404: errorResponse('Member not found') },
      },
      post: {
        tags: ['Clients'],
        summary: 'Add a note',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ type: 'object', required: ['body'], properties: { body: { type: 'string', example: 'Left knee sore on deep squats; keep to box squats this week.' } } }) },
        responses: { 201: { description: 'Created' }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Member not found') },
      },
    },
    '/clients/{id}/notes/{noteId}': {
      delete: {
        tags: ['Clients'],
        summary: 'Delete a note (its author, or an owner)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'noteId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 401: unauthorized, 403: forbidden, 404: errorResponse('Note not found') },
      },
    },
    '/resources': {
      get: {
        tags: ['Resources'],
        summary: 'Files you can see',
        description: "Members: from their trainer (shared with all clients or with them). Trainers: their own. Owners: the gym's.",
        responses: { 200: { description: 'Resources' }, 401: unauthorized, 403: forbidden },
      },
      post: {
        tags: ['Resources'],
        summary: 'Upload a file and share it',
        description: 'PDF, JPG, PNG or WebP up to 10 MB, checked to be what it claims. Without memberIds, trainers share with all their clients; owners must pick members.',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', required: ['file', 'title'], properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string' }, description: { type: 'string' }, memberIds: { type: 'string', description: 'Comma-separated member ids (optional)' } } } } },
        },
        responses: { 201: { description: 'Uploaded' }, 400: errorResponse('Wrong type, fake file, over 10 MB, or not your client'), 401: unauthorized, 403: forbidden },
      },
    },
    '/resources/{id}/file': {
      get: {
        tags: ['Resources'],
        summary: 'Open or download a shared file',
        description: 'Only for people it is shared with. Add ?download=1 to save instead of open.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'The file' }, 302: { description: 'Redirect to a signed S3 link' }, 401: unauthorized, 403: forbidden, 404: errorResponse('File not found') },
      },
    },
    '/resources/{id}': {
      delete: {
        tags: ['Resources'],
        summary: 'Delete a file (its uploader, or an owner)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 401: unauthorized, 403: forbidden, 404: errorResponse('File not found') },
      },
    },
    '/nutrition': {
      get: {
        tags: ['Nutrition'],
        summary: "A day's food and water, the goals, and the last 7 days' totals",
        parameters: [{ name: 'day', in: 'query', schema: { type: 'string', example: '2026-10-27' } }, { name: 'member', in: 'query', schema: { type: 'string' }, description: 'Trainers/owners: which client' }, { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 } }],
        responses: { 200: { description: 'Nutrition day' }, 400: badRequest, 401: unauthorized, 403: forbidden, 404: errorResponse('Member not found') },
      },
    },
    '/nutrition/goals': {
      put: {
        tags: ['Nutrition'],
        summary: 'Set your daily targets (members)',
        requestBody: { required: true, content: json({ type: 'object', properties: { calories: { type: 'integer', example: 2000 }, protein: { type: 'integer', example: 110 }, carbs: { type: 'integer' }, fat: { type: 'integer' }, waterMl: { type: 'integer', example: 3000 } } }) },
        responses: { 200: { description: 'Saved' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/nutrition/entries': {
      post: {
        tags: ['Nutrition'],
        summary: 'Log a food',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['day', 'meal', 'name', 'calories'],
            properties: { day: { type: 'string', example: '2026-10-27' }, meal: { type: 'string', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] }, name: { type: 'string', example: 'Paneer bhurji, 2 rotis' }, calories: { type: 'number', example: 520 }, protein: { type: 'number', example: 28 }, carbs: { type: 'number' }, fat: { type: 'number' } },
          }),
        },
        responses: { 201: { description: 'Logged' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/nutrition/entries/{id}': {
      delete: {
        tags: ['Nutrition'],
        summary: 'Remove a logged food',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Removed' }, 401: unauthorized, 403: forbidden, 404: errorResponse('Entry not found') },
      },
    },
    '/nutrition/water': {
      put: {
        tags: ['Nutrition'],
        summary: "Set a day's water intake",
        requestBody: { required: true, content: json({ type: 'object', required: ['day', 'waterMl'], properties: { day: { type: 'string' }, waterMl: { type: 'integer', example: 1750 } } }) },
        responses: { 200: { description: 'Saved' }, 400: badRequest, 401: unauthorized, 403: forbidden },
      },
    },
    '/reports/members.csv': {
      get: { tags: ['Reports'], summary: 'All members with their trainer and membership (CSV)', description: 'Needs `revenue:read` (owners).', parameters: [{ name: 'from', in: 'query', schema: { type: 'string', example: '2026-10-01' } }, { name: 'to', in: 'query', schema: { type: 'string', example: '2026-10-27' } }, { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 } }], responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } }, 401: unauthorized, 403: forbidden } },
    },
    '/reports/payments.csv': {
      get: { tags: ['Reports'], summary: 'Memberships and payments overlapping a date range (CSV)', description: 'Defaults to the last 30 days.', parameters: [{ name: 'from', in: 'query', schema: { type: 'string', example: '2026-10-01' } }, { name: 'to', in: 'query', schema: { type: 'string', example: '2026-10-27' } }, { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 } }], responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } }, 401: unauthorized, 403: forbidden } },
    },
    '/reports/attendance.csv': {
      get: { tags: ['Reports'], summary: 'Check-ins in a date range (CSV)', parameters: [{ name: 'from', in: 'query', schema: { type: 'string', example: '2026-10-01' } }, { name: 'to', in: 'query', schema: { type: 'string', example: '2026-10-27' } }, { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 } }], responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } }, 401: unauthorized, 403: forbidden } },
    },
    '/reports/trainers': {
      get: {
        tags: ['Reports'],
        summary: 'Trainer performance over a date range',
        description: 'Per trainer: clients, active plans, sessions (completed, no-show, cancelled, upcoming), classes taught and fill rate, reviews given, client workouts, and client gym visits per week.',
        parameters: [{ name: 'from', in: 'query', schema: { type: 'string', example: '2026-10-01' } }, { name: 'to', in: 'query', schema: { type: 'string', example: '2026-10-27' } }, { name: 'tz', in: 'query', schema: { type: 'integer', example: -330 } }],
        responses: { 200: { description: 'Trainer rows' }, 401: unauthorized, 403: forbidden },
      },
    },
  },
};
