'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

/**
 * Отримати всі компанії користувача
 */
export async function getUserCompanies(includeDeleted: boolean = false) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const userCompanies = await db.userCompany.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            edrpou: true,
            isActive: true,
            deletedAt: true,
            _count: {
              select: {
                declarations: true,
                syncHistory: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    // Фільтруємо компанії
    const filteredCompanies = userCompanies.filter(
      uc => includeDeleted ? true : !uc.company.deletedAt
    );

    return {
      success: true,
      companies: filteredCompanies.map(uc => ({
        id: uc.company.id,
        name: uc.company.name,
        edrpou: uc.company.edrpou,
        role: uc.role,
        isActive: uc.company.isActive,
        deletedAt: uc.company.deletedAt,
        declarationsCount: uc.company._count.declarations,
        syncHistoryCount: uc.company._count.syncHistory,
        isActiveCompany: uc.company.id === session.user.activeCompanyId,
        createdAt: uc.createdAt,
      }))
    };
  } catch (error: any) {
    console.error("Error getting user companies:", error);
    return { error: "Помилка отримання списку компаній" };
  }
}

/**
 * Отримати активну компанію користувача
 */
export async function getActiveCompany() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
    const access = await getActiveCompanyWithAccess();
    if (!access.success || !access.companyId) {
      return { error: access.error || "Активна компанія не встановлена" };
    }

    const company = await db.company.findUnique({
      where: { id: access.companyId },
      select: {
        id: true,
        name: true,
        edrpou: true,
        isActive: true,
        deletedAt: true,
        customsToken: true,
      }
    });

    if (!company || company.deletedAt) {
      return { error: "Активна компанія не знайдена або недоступна" };
    }

    return {
      success: true,
      company: {
        id: company.id,
        name: company.name,
        edrpou: company.edrpou,
        role: access.role,
        isActive: company.isActive,
        hasToken: !!company.customsToken,
      }
    };
  } catch (error: any) {
    console.error("Error getting active company:", error);
    return { error: "Помилка отримання активної компанії" };
  }
}

/**
 * Змінити активну компанію
 */
export async function setActiveCompany(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Неавторизований доступ" };
    }

    // Отримати user.id з БД по email (якщо id немає в сесії)
    let userId = session.user.id;
    if (!userId && session.user.email) {
      const userByEmail = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      if (userByEmail) {
        userId = userByEmail.id;
      }
    }

    if (!userId) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success) {
      return { error: access.error || "Доступ до компанії заборонено" };
    }

    // Оновити activeCompanyId в БД
    await db.user.update({
      where: { id: userId },
      data: { activeCompanyId: companyId },
    });

    // Оновити всі сторінки dashboard
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/companies");

    // Оновити сесію через update (тільки для NextAuth)
    // Це викличе jwt callback з trigger === 'update'
    // Але це потребує клієнтського виклику update() з NextAuth

    return { success: true, companyId };
  } catch (error: any) {
    console.error("Error setting active company:", error);
    return { error: "Помилка зміни активної компанії" };
  }
}

/**
 * Отримати роль користувача в компанії
 */
export async function getUserCompanyRole(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success) {
      return { error: access.error || "Доступ до компанії заборонено" };
    }

    return {
      success: true,
      role: access.role,
    };
  } catch (error: any) {
    console.error("Error getting user company role:", error);
    return { error: "Помилка отримання ролі" };
  }
}

/**
 * Створити нову компанію
 */
export async function createCompany(data: { name: string; edrpou: string; customsToken: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { name, edrpou, customsToken } = data;

    if (!name || !edrpou || !customsToken) {
      return { error: "Всі поля є обов'язковими" };
    }

    // Валідація EDRPOU (тільки цифри, 8 символів)
    if (!/^\d{8}$/.test(edrpou)) {
      return { error: "EDRPOU має містити рівно 8 цифр" };
    }

    // Перевірити чи компанія вже існує
    const existingCompany = await db.company.findUnique({
      where: { edrpou },
      select: { id: true, deletedAt: true },
    });

    if (existingCompany) {
      // Якщо компанія видалена, можна відновити
      if (existingCompany.deletedAt) {
        // Перевірити чи користувач вже має доступ
        const { checkCompanyAccess } = await import("@/lib/company-access");
        const access = await checkCompanyAccess(existingCompany.id, { allowDeleted: true });
        if (access.success) {
          return { error: "Ви вже є учасником цієї компанії" };
        }

        // Відновити компанію
        const { encrypt } = await import("@/lib/crypto");
        const encryptedToken = await encrypt(customsToken);

        await db.company.update({
          where: { id: existingCompany.id },
          data: {
            name,
            customsToken: encryptedToken,
            deletedAt: null,
            isActive: true,
          }
        });

        // Додати користувача як власника
        await db.userCompany.create({
          data: {
            userId: session.user.id,
            companyId: existingCompany.id,
            role: "OWNER",
            isActive: true,
          }
        });

        // Встановити як активну компанію
        await db.user.update({
          where: { id: session.user.id },
          data: { activeCompanyId: existingCompany.id },
        });

        // Записати в аудит
        await db.companyAuditLog.create({
          data: {
            companyId: existingCompany.id,
            userId: session.user.id,
            userName: session.user.name || session.user.email,
            action: "RESTORE_COMPANY",
            details: `Компанію відновлено користувачем`,
          }
        });

        revalidatePath("/dashboard");
        return { success: true, companyId: existingCompany.id };
      } else {
        // Компанія існує і не видалена
        return { error: "Компанія з таким EDRPOU вже існує. Використайте функцію приєднання." };
      }
    }

    // Створити нову компанію
    const { encrypt } = await import("@/lib/crypto");
    const encryptedToken = await encrypt(customsToken);

    const company = await db.company.create({
      data: {
        name,
        edrpou,
        customsToken: encryptedToken,
        isActive: true,
      }
    });

    // Додати користувача як власника
    await db.userCompany.create({
      data: {
        userId: session.user.id,
        companyId: company.id,
        role: "OWNER",
        isActive: true,
      }
    });

    // Встановити як активну компанію
    await db.user.update({
      where: { id: session.user.id },
      data: { activeCompanyId: company.id },
    });

    // Записати в аудит
    await db.companyAuditLog.create({
      data: {
        companyId: company.id,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "CREATE_COMPANY",
        details: `Компанію створено користувачем`,
      }
    });

    revalidatePath("/dashboard");
    return { success: true, companyId: company.id };
  } catch (error: any) {
    console.error("Error creating company:", error);

    // Обробка помилок унікальності
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('edrpou')) {
        return { error: "Компанія з таким EDRPOU вже існує" };
      }
    }

    return { error: "Помилка створення компанії" };
  }
}

/**
 * Вийти з компанії (тільки для не-власників)
 */
export async function leaveCompany(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success) {
      return { error: access.error || "Компанія не знайдена або недоступна" };
    }

    // Власник не може вийти - тільки видалити компанію
    if (access.role === "OWNER") {
      return { error: "Власник не може вийти з компанії. Використайте функцію видалення компанії або передайте власність." };
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true }
    });

    // Видалити зв'язок
    await db.userCompany.delete({
      where: {
        userId_companyId: {
          userId: session.user.id,
          companyId: companyId,
        }
      }
    });

    // Якщо це була активна компанія, встановити іншу або null
    if (session.user.activeCompanyId === companyId) {
      // Знайти першу доступну компанію
      const firstCompany = await db.userCompany.findFirst({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        include: {
          company: {
            select: {
              deletedAt: true,
            }
          }
        }
      });

      const newActiveId = firstCompany && !firstCompany.company.deletedAt
        ? firstCompany.companyId
        : null;

      await db.user.update({
        where: { id: session.user.id },
        data: { activeCompanyId: newActiveId },
      });
    }

    // Записати в аудит
    await db.companyAuditLog.create({
      data: {
        companyId: companyId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "LEAVE_COMPANY",
        details: `Користувач вийшов з компанії${company?.name ? ` (${company.name})` : ''}`,
      }
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error leaving company:", error);
    return { error: "Помилка виходу з компанії" };
  }
}

/**
 * Видалити компанію (м'яке видалення, тільки для OWNER)
 */
export async function deleteCompany(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success) {
      return { error: access.error || "Компанія не знайдена або вже видалена" };
    }

    // Тільки власник може видаляти
    if (access.role !== "OWNER") {
      return { error: "Тільки власник може видаляти компанію" };
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { deletedAt: true }
    });

    if (!company || company.deletedAt) {
      return { error: "Компанія не знайдена або вже видалена" };
    }

    // М'яке видалення
    await db.company.update({
      where: { id: companyId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      }
    });

    // Якщо це була активна компанія, встановити іншу або null
    if (session.user.activeCompanyId === companyId) {
      // Знайти першу доступну компанію
      const firstCompany = await db.userCompany.findFirst({
        where: {
          userId: session.user.id,
          isActive: true,
          companyId: { not: companyId },
        },
        include: {
          company: {
            select: {
              deletedAt: true,
            }
          }
        }
      });

      const newActiveId = firstCompany && !firstCompany.company.deletedAt
        ? firstCompany.companyId
        : null;

      await db.user.update({
        where: { id: session.user.id },
        data: { activeCompanyId: newActiveId },
      });
    }

    // Записати в аудит
    await db.companyAuditLog.create({
      data: {
        companyId: companyId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "DELETE_COMPANY",
        details: `Компанію видалено (м'яке видалення)`,
      }
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting company:", error);
    return { error: "Помилка видалення компанії" };
  }
}

/**
 * Відновити компанію (тільки для OWNER)
 */
export async function restoreCompany(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId, { allowDeleted: true });
    if (!access.success) {
      return { error: access.error || "Доступ до компанії заборонено" };
    }

    if (access.role !== 'OWNER') {
      return { error: "Тільки власник може відновлювати компанію" };
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { deletedAt: true }
    });

    if (!company?.deletedAt) {
      return { error: "Компанія не видалена" };
    }

    // Перевірити чи не минуло 90 днів
    const daysSinceDeletion = Math.floor(
      (new Date().getTime() - company.deletedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDeletion > 90) {
      return { error: "Неможливо відновити компанію після 90 днів з моменту видалення" };
    }

    // Відновити компанію
    await db.company.update({
      where: { id: companyId },
      data: {
        deletedAt: null,
        isActive: true,
      }
    });

    // Записати в аудит
    await db.companyAuditLog.create({
      data: {
        companyId: companyId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "RESTORE_COMPANY",
        details: `Компанію відновлено після видалення`,
      }
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error restoring company:", error);
    return { error: "Помилка відновлення компанії" };
  }
}

/**
 * Надіслати запрошення до компанії
 */
export async function inviteUser(companyId: string, email: string, role: 'MEMBER' | 'VIEWER') {
  try {

    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const userId = session.user.id;

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success) {
      return { error: access.error || "Доступ до компанії заборонено" };
    }

    if (access.role !== 'OWNER') {
      return { error: "Тільки власник може надсилати запрошення" };
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true }
    });

    // Валідація email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: "Невірний формат email" };
    }

    // Перевірити чи користувач вже учасник
    const existingUser = await db.user.findUnique({
      where: { email },
      include: {
        companies: {
          where: { companyId: companyId },
        }
      }
    });

    if (existingUser && existingUser.companies.length > 0) {
      return { error: "Користувач вже є учасником цієї компанії" };
    }

    // Генерувати унікальний токен
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 днів

    // Підготувати дані
    const invitationData: any = {
      companyId: companyId,
      email: email.toLowerCase(),
      role: role,
      token: token,
      invitedBy: userId,
      status: "PENDING",
      expiresAt: expiresAt,
    };
    if (existingUser) {
      invitationData.targetUserId = existingUser.id;
    }

    let notificationCreated = false;

    // Транзакція створення
    const result = await db.$transaction(async (tx) => {
      const invitation = await tx.companyInvitation.create({
        data: invitationData
      });

      if (existingUser) {
        await tx.notification.create({
          data: {
            userId: existingUser.id,
            type: "COMPANY_INVITE",
            title: `Запрошення до компанії ${company?.name}`,
            message: `${session.user.name || session.user.email} запрошує вас приєднатися до компанії "${company?.name}" у ролі ${role === 'MEMBER' ? 'Учасника' : 'Спостерігача'}.`,
            data: {
              invitationId: invitation.id,
              companyId: companyId,
              companyName: company?.name,
              inviterName: session.user.name || session.user.email,
              role: role,
              token: token
            }
          }
        });
        notificationCreated = true;
      }

      await tx.companyAuditLog.create({
        data: {
          companyId: companyId,
          userId: userId,
          userName: session.user.name || session.user.email,
          action: "INVITE_USER",
          targetUserName: email,
          targetUserId: existingUser ? existingUser.id : null,
          newValue: JSON.stringify({ email, role, method: existingUser ? 'NOTIFICATION' : 'LINK' }),
          details: `Запрошення надіслано користувачу ${email} з роллю ${role}`,
        }
      });

      return invitation;
    });

    revalidatePath("/dashboard/companies");

    if (notificationCreated) {
      return { success: true, method: 'NOTIFICATION', message: 'Користувача сповіщено про запрошення.' };
    } else {
      return { success: true, method: 'LINK', invitationId: result.id, token: token };
    }
  } catch (error: any) {
    console.error("Error inviting user:", error);

    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return { error: "Запрошення для цього email вже існує" };
    }

    return { error: `Помилка надсилання запрошення: ${error.message}` };
  }
}

/**
 * Отримати запрошення компанії
 */
export async function getInvitations(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success || access.role !== 'OWNER') {
      return { error: "Доступ заборонено. Тільки власник може переглядати запрошення." };
    }

    const invitations = await db.companyInvitation.findMany({
      where: {
        companyId: companyId,
        status: { in: ["PENDING", "EXPIRED"] },
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    // Оновити статус протермінованих запрошень
    const now = new Date();
    for (const inv of invitations) {
      if (inv.status === "PENDING" && inv.expiresAt < now) {
        await db.companyInvitation.update({
          where: { id: inv.id },
          data: { status: "EXPIRED" },
        });
      }
    }

    // Отримати оновлений список
    const updatedInvitations = await db.companyInvitation.findMany({
      where: {
        companyId: companyId,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return {
      success: true,
      invitations: updatedInvitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
      }))
    };
  } catch (error: any) {
    console.error("Error getting invitations:", error);
    return { error: "Помилка отримання запрошень" };
  }
}

/**
 * Скасувати запрошення
 */
export async function cancelInvitation(companyId: string, invitationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success || access.role !== 'OWNER') {
      return { error: "Тільки власник може скасовувати запрошення" };
    }

    const invitation = await db.companyInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.companyId !== companyId) {
      return { error: "Запрошення не знайдено" };
    }

    if (invitation.status !== "PENDING") {
      return { error: "Можна скасувати тільки активні запрошення" };
    }

    await db.companyInvitation.delete({
      where: { id: invitationId },
    });

    // Записати в аудит
    await db.companyAuditLog.create({
      data: {
        companyId: companyId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "CANCEL_INVITATION",
        targetUserName: invitation.email,
        details: `Запрошення для ${invitation.email} скасовано`,
      }
    });

    revalidatePath("/dashboard/companies");
    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling invitation:", error);
    return { error: "Помилка скасування запрошення" };
  }
}

/**
 * Отримати історію змін (аудит лог) компанії
 */
export async function getCompanyAuditLog(companyId: string, limit: number = 50) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);
    if (!access.success) {
      return { error: access.error || "Доступ до компанії заборонено" };
    }

    const logs = await db.companyAuditLog.findMany({
      where: {
        companyId: companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return {
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.userName,
        action: log.action,
        targetUserId: log.targetUserId,
        targetUserName: log.targetUserName,
        oldValue: log.oldValue,
        newValue: log.newValue,
        details: log.details,
        createdAt: log.createdAt,
      }))
    };
  } catch (error: any) {
    console.error("Error getting audit log:", error);
    return { error: "Помилка отримання історії змін" };
  }
}

/**
 * Отримати список учасників компанії
 */
export async function getCompanyMembers(companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);

    if (!access.success) {
      return { error: access.error };
    }

    const members = await db.userCompany.findMany({
      where: {
        companyId: companyId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          }
        }
      },
      orderBy: {
        role: 'desc',
      }
    });

    return {
      success: true,
      members: members.map(m => ({
        userId: m.userId,
        email: m.user.email,
        fullName: m.user.fullName,
        role: m.role,
        joinedAt: m.createdAt,
      }))
    };
  } catch (error: any) {
    console.error("Error getting company members:", error);
    return { error: "Помилка отримання списку учасників" };
  }
}

/**
 * Змінити роль учасника (тільки OWNER)
 */
export async function updateMemberRole(companyId: string, userId: string, newRole: 'MEMBER' | 'VIEWER') {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    // Тільки власник може змінювати ролі
    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);

    if (!access.success) return { error: access.error };
    if (access.role !== 'OWNER') {
      return { error: "Тільки власник може змінювати ролі учасників" };
    }

    // Не можна змінювати роль самому собі через цю функцію
    if (userId === session.user.id) {
      return { error: "Не можна змінити власну роль" };
    }

    const targetUserCompany = await db.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: companyId,
        }
      }
    });

    if (!targetUserCompany || !targetUserCompany.isActive) {
      return { error: "Користувач не є учасником компанії" };
    }

    if (targetUserCompany.role === 'OWNER') {
      return { error: "Не можна змінити роль власника. Використайте передачу власності." };
    }

    await db.userCompany.update({
      where: { id: targetUserCompany.id },
      data: { role: newRole }
    });

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });

    // Audit log
    await db.companyAuditLog.create({
      data: {
        companyId: companyId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "CHANGE_ROLE",
        targetUserId: userId,
        targetUserName: targetUser?.fullName || targetUser?.email,
        oldValue: targetUserCompany.role,
        newValue: newRole,
        details: `Роль змінено з ${targetUserCompany.role} на ${newRole}`,
      }
    });

    revalidatePath("/dashboard/companies");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating member role:", error);
    return { error: "Помилка зміни ролі" };
  }
}

/**
 * Видалити учасника з компанії (тільки OWNER)
 */
export async function removeCompanyMember(companyId: string, userId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Неавторизований доступ" };
    }

    const { checkCompanyAccess } = await import("@/lib/company-access");
    const access = await checkCompanyAccess(companyId);

    if (!access.success) return { error: access.error };
    if (access.role !== 'OWNER') {
      return { error: "Тільки власник може видаляти учасників" };
    }

    if (userId === session.user.id) {
      return { error: "Не можна видалити самого себе. Використайте видалення компанії." };
    }

    const targetUserCompany = await db.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: companyId,
        }
      }
    });

    if (!targetUserCompany || !targetUserCompany.isActive) {
      return { error: "Користувач не є учасником компанії" };
    }

    if (targetUserCompany.role === 'OWNER') {
      return { error: "Не можна видалити власника" };
    }

    await db.userCompany.delete({
      where: { id: targetUserCompany.id }
    });

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });

    // Audit log
    await db.companyAuditLog.create({
      data: {
        companyId: companyId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "REMOVE_MEMBER",
        targetUserId: userId,
        targetUserName: targetUser?.fullName || targetUser?.email,
        details: `Учасника видалено з компанії`,
      }
    });

    revalidatePath("/dashboard/companies");
    return { success: true };
  } catch (error: any) {
    console.error("Error removing member:", error);
    return { error: "Помилка видалення учасника" };
  }
}

/**
 * Отримати дані про запрошення по токену
 */
export async function getInvitationByToken(token: string) {
  try {
    const invitation = await db.companyInvitation.findUnique({
      where: { token: token },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!invitation) {
      return { error: "Запрошення не знайдено" };
    }

    if (invitation.status !== "PENDING") {
      return { error: `Запрошення вже ${invitation.status === 'ACCEPTED' ? 'прийнято' : 'використано або скасовано'}` };
    }

    if (invitation.expiresAt < new Date()) {
      // Позначити як протерміноване
      await db.companyInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" }
      });
      return { error: "Термін дії запрошення вичерпано" };
    }

    // Отримати ім'я того хто запросив
    let inviterName = "Адміністратор";
    if (invitation.invitedBy) {
      const inviter = await db.user.findUnique({
        where: { id: invitation.invitedBy },
        select: { fullName: true, email: true }
      });
      if (inviter) {
        inviterName = inviter.fullName || inviter.email;
      }
    }

    return {
      success: true,
      invitation: {
        id: invitation.id,
        companyName: invitation.company.name,
        inviterName: inviterName,
        email: invitation.email,
        role: invitation.role,
      }
    };
  } catch (error: any) {
    console.error("Error getting invitation:", error);
    return { error: "Помилка перевірки запрошення" };
  }
}

/**
 * Прийняти запрошення
 */
export async function acceptInvitation(token: string) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return { error: "Необхідно увійти в систему" };
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name || userEmail || "Unknown";

    // Транзакція для атомарності
    return await db.$transaction(async (tx) => {
      const invitation = await tx.companyInvitation.findUnique({
        where: { token: token },
      });

      if (!invitation || invitation.status !== "PENDING") {
        throw new Error("Запрошення недійсне");
      }

      if (invitation.expiresAt < new Date()) {
        await tx.companyInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" }
        });
        throw new Error("Термін дії запрошення вичерпано");
      }

      // Перевірка email
      if (userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error(`Це запрошення призначене для ${invitation.email}. Ви увійшли як ${userEmail}.`);
      }

      // Перевірити чи користувач вже учасник
      const existingMember = await tx.userCompany.findUnique({
        where: {
          userId_companyId: {
            userId: userId,
            companyId: invitation.companyId
          }
        }
      });

      if (existingMember) {
        await tx.companyInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() }
        });
        return { success: true, message: "Ви вже є учасником цієї компанії" };
      }

      // Додати користувача до компанії
      await tx.userCompany.create({
        data: {
          userId: userId,
          companyId: invitation.companyId,
          role: invitation.role,
          isActive: true,
        }
      });

      // Оновити статус запрошення
      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() }
      });

      // Записати в аудит
      await tx.companyAuditLog.create({
        data: {
          companyId: invitation.companyId,
          userId: userId,
          userName: userName,
          action: "JOIN_COMPANY",
          details: `Користувач приєднався до компанії за запрошенням`,
        }
      });

      return { success: true };
    });
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return { error: error.message || "Помилка прийняття запрошення" };
  }
}

/**
 * Відхилити запрошення
 */
export async function rejectInvitation(token: string) {
  try {
    const invitation = await db.companyInvitation.findUnique({
      where: { token: token }
    });

    if (!invitation || invitation.status !== "PENDING") {
      return { error: "Запрошення недійсне" };
    }

    await db.companyInvitation.update({
      where: { id: invitation.id },
      data: { status: "REJECTED" }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error rejecting invitation:", error);
    return { error: "Помилка відхилення запрошення" };
  }
}
