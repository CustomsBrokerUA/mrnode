/**
 * Helper функції для роботи з доступом до компаній
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";

export interface CompanyAccessResult {
  success: boolean;
  companyId?: string;
  role?: 'OWNER' | 'MEMBER' | 'VIEWER';
  error?: string;
}

export interface CompanyFullAccessResult extends CompanyAccessResult {
  customsToken?: string;
  edrpou?: string;
  name?: string;
}

/**
 * Отримати активну компанію користувача з перевіркою доступу
 */
export async function getActiveCompanyWithAccess(): Promise<CompanyAccessResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Неавторизований доступ" };
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
      return { success: false, error: "Неавторизований доступ" };
    }

    // Отримати activeCompanyId з БД (не з сесії, бо сесія може бути застарілою)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { activeCompanyId: true }
    });

    let activeCompanyId = user?.activeCompanyId;

    // Якщо activeCompanyId не встановлено, знайти першу активну компанію
    // Це відбувається тільки один раз при першому вході
    if (!activeCompanyId) {
      const firstUserCompany = await db.userCompany.findFirst({
        where: {
          userId: userId,
          isActive: true,
        },
        include: {
          company: {
            select: {
              deletedAt: true,
            }
          }
        },
        orderBy: {
          createdAt: 'asc', // Перша створена компанія
        }
      });

      if (firstUserCompany && !firstUserCompany.company.deletedAt) {
        activeCompanyId = firstUserCompany.companyId;
        
        // Встановити activeCompanyId в БД
        await db.user.update({
          where: { id: userId },
          data: { activeCompanyId: firstUserCompany.companyId }
        });
      } else {
        return { success: false, error: "Активна компанія не встановлена" };
      }
    }

    // Перевірити доступ до компанії
    const userCompany = await db.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: activeCompanyId,
        }
      },
      include: {
        company: {
          select: {
            deletedAt: true,
          }
        }
      }
    });

    if (!userCompany || !userCompany.isActive || userCompany.company.deletedAt) {
      // Якщо компанія недоступна, спробувати знайти іншу
      const alternativeUserCompany = await db.userCompany.findFirst({
        where: {
          userId: userId,
          isActive: true,
          companyId: { not: activeCompanyId },
        },
        include: {
          company: {
            select: {
              deletedAt: true,
            }
          }
        }
      });

      if (alternativeUserCompany && !alternativeUserCompany.company.deletedAt) {
        // Оновити activeCompanyId
        await db.user.update({
          where: { id: userId },
          data: { activeCompanyId: alternativeUserCompany.companyId }
        });

        return {
          success: true,
          companyId: alternativeUserCompany.companyId,
          role: alternativeUserCompany.role as 'OWNER' | 'MEMBER' | 'VIEWER',
        };
      }

      return { success: false, error: "Доступ до активної компанії заборонено" };
    }

    return {
      success: true,
      companyId: activeCompanyId,
      role: userCompany.role as 'OWNER' | 'MEMBER' | 'VIEWER',
    };
  } catch (error: any) {
    console.error("Error getting active company with access:", error);
    return { success: false, error: "Помилка отримання доступу до компанії" };
  }
}

/**
 * Перевірити доступ до конкретної компанії
 */
export async function checkCompanyAccess(companyId: string): Promise<CompanyAccessResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Неавторизований доступ" };
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
      return { success: false, error: "Неавторизований доступ" };
    }

    const userCompany = await db.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: companyId,
        }
      },
      include: {
        company: {
          select: {
            deletedAt: true,
          }
        }
      }
    });

    if (!userCompany || !userCompany.isActive || userCompany.company.deletedAt) {
      return { success: false, error: "Доступ до компанії заборонено" };
    }

    return {
      success: true,
      companyId: companyId,
      role: userCompany.role as 'OWNER' | 'MEMBER' | 'VIEWER',
    };
  } catch (error: any) {
    console.error("Error checking company access:", error);
    return { success: false, error: "Помилка перевірки доступу до компанії" };
  }
}

/**
 * Отримати повну інформацію про активну компанію (включаючи токен та edrpou)
 * Тільки для OWNER та MEMBER
 */
export async function getActiveCompanyFullAccess(): Promise<CompanyFullAccessResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Неавторизований доступ" };
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
      return { success: false, error: "Неавторизований доступ" };
    }

    // Спочатку отримати activeCompanyId через getActiveCompanyWithAccess
    const access = await getActiveCompanyWithAccess();
    if (!access.success || !access.companyId) {
      return { success: false, error: access.error || "Активна компанія не встановлена" };
    }

    const userCompany = await db.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: access.companyId,
        }
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            edrpou: true,
            customsToken: true,
            deletedAt: true,
          }
        }
      }
    });

    if (!userCompany || !userCompany.isActive || userCompany.company.deletedAt) {
      return { success: false, error: "Доступ до активної компанії заборонено" };
    }

    // Тільки OWNER та MEMBER можуть отримувати токен
    if (userCompany.role !== 'OWNER' && userCompany.role !== 'MEMBER') {
      return { success: false, error: "Недостатньо прав для доступу до токену" };
    }

    return {
      success: true,
      companyId: access.companyId,
      role: userCompany.role as 'OWNER' | 'MEMBER' | 'VIEWER',
      customsToken: userCompany.company.customsToken || undefined,
      edrpou: userCompany.company.edrpou,
      name: userCompany.company.name,
    };
  } catch (error: any) {
    console.error("Error getting active company full access:", error);
    return { success: false, error: "Помилка отримання доступу до компанії" };
  }
}

/**
 * Перевірити чи роль дозволяє виконання операції
 */
export function canPerformAction(role: 'OWNER' | 'MEMBER' | 'VIEWER', requiredRole: 'OWNER' | 'MEMBER' | 'VIEWER'): boolean {
  const roleHierarchy = {
    'OWNER': 3,
    'MEMBER': 2,
    'VIEWER': 1,
  };

  return roleHierarchy[role] >= roleHierarchy[requiredRole];
}
