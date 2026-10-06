import {
  ActorType,
  MembershipStatus,
  OrgRole,
  PaymentType,
  PrismaClient,
  StateGroup,
} from '@prisma/client';

const prisma = new PrismaClient();

const organizationId = 'beta-arus-org';

const betaUsers = [
  {
    id: 'afiq-rahman',
    name: 'Afiq Rahman',
    email: 'afiq@arus.example',
    roles: [OrgRole.STAFF],
  },
  {
    id: 'siti-farhana',
    name: 'Siti Farhana',
    email: 'farhana@arus.example',
    roles: [OrgRole.FINANCE_ADMIN],
  },
  {
    id: 'nadia-hassan',
    name: 'Nadia Hassan',
    email: 'nadia@arus.example',
    roles: [OrgRole.MANAGER],
  },
  {
    id: 'amir-iskandar',
    name: 'Amir Iskandar',
    email: 'amir@arus.example',
    roles: [OrgRole.DIRECTOR],
  },
  {
    id: 'farid-hakim',
    name: 'Farid Hakim',
    email: 'farid@arus.example',
    roles: [OrgRole.DIRECTOR],
  },
  {
    id: 'maryam-iskandar',
    name: 'Maryam Iskandar',
    email: 'maryam@arus.example',
    roles: [OrgRole.DIRECTOR],
  },
  {
    id: 'daniel-lee',
    name: 'Daniel Lee',
    email: 'daniel@arus.example',
    roles: [OrgRole.DIRECTOR],
  },
] as const;

const glAccounts = [
  {
    code: '5100',
    name: 'Transport Claims',
    description: 'Transport and local travel expenses',
  },
  {
    code: '5200',
    name: 'Programme Materials',
    description: 'Materials and supplies used by programmes',
  },
  {
    code: '5300',
    name: 'Professional Services',
    description: 'Professional and contracted services',
  },
] as const;

const areas = [
  { code: 'PROGRAMME', name: 'Programme' },
  { code: 'FINANCE', name: 'Finance' },
  { code: 'OPERATIONS', name: 'Operations' },
] as const;

const projects = [
  { code: 'GENERAL', name: 'General Operations' },
  { code: 'PROGRAMME', name: 'Programme Activities' },
] as const;

const paymentVoucherStates = [
  {
    state_code: 'DRAFT',
    state_group: StateGroup.DRAFT,
    label: 'Draft',
    is_terminal: false,
    sort_order: 1,
  },
  {
    state_code: 'PENDING_DIRECTOR_APPROVAL',
    state_group: StateGroup.IN_REVIEW,
    label: 'Pending Director Approval',
    is_terminal: false,
    sort_order: 2,
  },
  {
    state_code: 'REJECTED',
    state_group: StateGroup.REJECTED,
    label: 'Rejected',
    is_terminal: false,
    sort_order: 3,
  },
  {
    state_code: 'APPROVED_FOR_PAYMENT',
    state_group: StateGroup.IN_REVIEW,
    label: 'Approved for Payment',
    is_terminal: false,
    sort_order: 4,
  },
  {
    state_code: 'FINANCE_PROCESSING',
    state_group: StateGroup.IN_REVIEW,
    label: 'Finance Processing',
    is_terminal: false,
    sort_order: 5,
  },
  {
    state_code: 'AWAITING_RECIPIENT_SIGNATURE',
    state_group: StateGroup.AWAITING_EXTERNAL_ACTION,
    label: 'Awaiting Recipient Signature',
    is_terminal: false,
    sort_order: 6,
  },
  {
    state_code: 'AWAITING_STAFF_CONFIRMATION',
    state_group: StateGroup.PENDING_VERIFICATION,
    label: 'Awaiting Staff Confirmation',
    is_terminal: false,
    sort_order: 7,
  },
  {
    state_code: 'PENDING_FINANCE_VERIFICATION',
    state_group: StateGroup.PENDING_VERIFICATION,
    label: 'Pending Finance Verification',
    is_terminal: false,
    sort_order: 8,
  },
  {
    state_code: 'COMPLETED',
    state_group: StateGroup.COMPLETE,
    label: 'Completed',
    is_terminal: true,
    sort_order: 9,
  },
  {
    state_code: 'INACTIVE',
    state_group: StateGroup.VOIDED,
    label: 'Inactive',
    is_terminal: true,
    sort_order: 10,
  },
] as const;

const paymentVoucherTransitions = [
  {
    from_state_code: 'DRAFT',
    action_code: 'SUBMIT_FOR_APPROVAL',
    to_state_code: 'PENDING_DIRECTOR_APPROVAL',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.STAFF,
  },
  {
    from_state_code: 'REJECTED',
    action_code: 'RESUBMIT',
    to_state_code: 'PENDING_DIRECTOR_APPROVAL',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.STAFF,
  },
  {
    from_state_code: 'PENDING_DIRECTOR_APPROVAL',
    action_code: 'APPROVE',
    to_state_code: 'APPROVED_FOR_PAYMENT',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.DIRECTOR,
  },
  {
    from_state_code: 'PENDING_DIRECTOR_APPROVAL',
    action_code: 'REJECT',
    to_state_code: 'REJECTED',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.DIRECTOR,
    requires_reason: true,
  },
  {
    from_state_code: 'APPROVED_FOR_PAYMENT',
    action_code: 'START_FINANCE_REVIEW',
    to_state_code: 'FINANCE_PROCESSING',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.FINANCE_ADMIN,
  },
  {
    from_state_code: 'FINANCE_PROCESSING',
    action_code: 'RECORD_PAYMENT',
    to_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.FINANCE_ADMIN,
    requires_document: true,
  },
  {
    from_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
    action_code: 'COLLECT_SIGNATURE',
    to_state_code: 'AWAITING_STAFF_CONFIRMATION',
    allowed_actor_type: ActorType.EXTERNAL_RECIPIENT,
    allowed_role: null,
    requires_document: true,
  },
  {
    from_state_code: 'AWAITING_STAFF_CONFIRMATION',
    action_code: 'CONFIRM_SIGNED_PV',
    to_state_code: 'PENDING_FINANCE_VERIFICATION',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.STAFF,
    requires_document: true,
  },
  {
    from_state_code: 'PENDING_FINANCE_VERIFICATION',
    action_code: 'COMPLETE',
    to_state_code: 'COMPLETED',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.FINANCE_ADMIN,
    requires_document: true,
  },
  {
    from_state_code: 'PENDING_FINANCE_VERIFICATION',
    action_code: 'RETURN_SIGNED_PV',
    to_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.FINANCE_ADMIN,
    requires_reason: true,
  },
  {
    from_state_code: 'FINANCE_PROCESSING',
    action_code: 'MARK_INACTIVE',
    to_state_code: 'INACTIVE',
    allowed_actor_type: ActorType.INTERNAL_USER,
    allowed_role: OrgRole.FINANCE_ADMIN,
    requires_reason: true,
  },
] as const;

async function seedOrganization() {
  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {
      name: 'Arus Education Sdn Bhd',
      registration_no: '1177232-U',
      registered_address: 'Malaysia',
      currency_code: 'MYR',
      is_active: true,
    },
    create: {
      id: organizationId,
      name: 'Arus Education Sdn Bhd',
      registration_no: '1177232-U',
      registered_address: 'Malaysia',
      currency_code: 'MYR',
      is_active: true,
    },
  });
}

async function seedUsersAndRoles() {
  for (const betaUser of betaUsers) {
    await prisma.user.upsert({
      where: { id: betaUser.id },
      update: {
        name: betaUser.name,
        email: betaUser.email,
      },
      create: {
        id: betaUser.id,
        name: betaUser.name,
        email: betaUser.email,
      },
    });

    const membershipId = `membership-${betaUser.id}`;

    const membership = await prisma.userOrgMembership.upsert({
      where: {
        user_id_organization_id: {
          user_id: betaUser.id,
          organization_id: organizationId,
        },
      },
      update: {
        membership_status: MembershipStatus.ACTIVE,
        is_active: true,
      },
      create: {
        id: membershipId,
        user_id: betaUser.id,
        organization_id: organizationId,
        membership_status: MembershipStatus.ACTIVE,
        is_active: true,
      },
    });

    for (const role of betaUser.roles) {
      await prisma.userOrgRole.upsert({
        where: {
          membership_id_role: {
            membership_id: membership.id,
            role,
          },
        },
        update: {},
        create: {
          membership_id: membership.id,
          role,
        },
      });
    }
  }
}

async function seedAccountingReferences() {
  for (const account of glAccounts) {
    await prisma.glAccount.upsert({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: account.code,
        },
      },
      update: {
        name: account.name,
        description: account.description,
        is_active: true,
      },
      create: {
        organization_id: organizationId,
        code: account.code,
        name: account.name,
        description: account.description,
        is_active: true,
      },
    });
  }

  for (const area of areas) {
    await prisma.area.upsert({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: area.code,
        },
      },
      update: {
        name: area.name,
        is_active: true,
      },
      create: {
        organization_id: organizationId,
        code: area.code,
        name: area.name,
        is_active: true,
      },
    });
  }

  for (const project of projects) {
    await prisma.project.upsert({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: project.code,
        },
      },
      update: {
        name: project.name,
        is_active: true,
      },
      create: {
        organization_id: organizationId,
        code: project.code,
        name: project.name,
        is_active: true,
      },
    });
  }
}

async function seedPaymentVoucherWorkflow() {
  const workflow = await prisma.workflowDefinition.upsert({
    where: {
      payment_type_version: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        version: 1,
      },
    },
    update: { is_active: true },
    create: {
      payment_type: PaymentType.PAYMENT_VOUCHER,
      version: 1,
      is_active: true,
    },
  });

  for (const state of paymentVoucherStates) {
    await prisma.workflowState.upsert({
      where: {
        workflow_definition_id_state_code: {
          workflow_definition_id: workflow.id,
          state_code: state.state_code,
        },
      },
      update: {
        state_group: state.state_group,
        label: state.label,
        is_terminal: state.is_terminal,
        sort_order: state.sort_order,
      },
      create: {
        workflow_definition_id: workflow.id,
        ...state,
      },
    });
  }

  // Transition rules have a nullable role in their compound uniqueness rule.
  // Replacing this definition's rules keeps the seed safely rerunnable.
  await prisma.workflowTransitionRule.deleteMany({
    where: { workflow_definition_id: workflow.id },
  });

  await prisma.workflowTransitionRule.createMany({
    data: paymentVoucherTransitions.map((transition) => ({
      workflow_definition_id: workflow.id,
      requires_reason: false,
      requires_document: false,
      is_active: true,
      ...transition,
    })),
  });
}

async function main() {
  console.log('Seeding Estuary Beta database...');

  await seedOrganization();
  await seedUsersAndRoles();
  await seedAccountingReferences();
  await seedPaymentVoucherWorkflow();

  console.log('Estuary Beta database seed completed.');
}

main()
  .catch((error: unknown) => {
    console.error('Estuary database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
