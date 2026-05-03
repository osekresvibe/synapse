
import { PROCESSING_COSTS, type UserSubscription } from '@shared/pricing';

export class ProcessingCreditManager {
  /**
   * Calculate processing cost for video compression
   */
  static calculateCompressionCost(
    fileSizeGB: number,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): number {
    const baseCost = fileSizeGB * PROCESSING_COSTS.compression.perGB;
    const multiplier = PROCESSING_COSTS.compression.qualityMultipliers[quality];
    return Math.ceil(baseCost * multiplier);
  }

  /**
   * Calculate processing cost for format conversion
   */
  static calculateConversionCost(
    videoDurationMinutes: number,
    fromFormat: string,
    toFormat: string
  ): number {
    const baseCost = videoDurationMinutes * PROCESSING_COSTS.conversion.perMinuteOfVideo;
    
    // Determine format conversion type
    const conversionKey = `${fromFormat}-to-${toFormat}` as keyof typeof PROCESSING_COSTS.conversion.formatMultipliers;
    const multiplier = PROCESSING_COSTS.conversion.formatMultipliers[conversionKey] 
      || PROCESSING_COSTS.conversion.formatMultipliers['any-to-optimized'];
    
    return Math.ceil(baseCost * multiplier);
  }

  /**
   * Calculate combined compression + conversion cost
   */
  static calculateCombinedCost(
    fileSizeGB: number,
    videoDurationMinutes: number,
    quality: 'low' | 'medium' | 'high',
    fromFormat: string,
    toFormat: string
  ): number {
    const compressionCost = this.calculateCompressionCost(fileSizeGB, quality);
    const conversionCost = this.calculateConversionCost(videoDurationMinutes, fromFormat, toFormat);
    const combinedCost = (compressionCost + conversionCost) * PROCESSING_COSTS.compressionAndConversion;
    
    return Math.ceil(combinedCost);
  }

  /**
   * Check if user has enough processing credits
   */
  static canProcess(subscription: UserSubscription, requiredMinutes: number): {
    canProcess: boolean;
    remainingMinutes: number;
    newRenewalDate: Date;
  } {
    const processingCredits = subscription.processingCredits || {
      totalMinutes: 43200, // 30 days default
      usedMinutes: 0,
      renewalDate: subscription.endDate
    };

    const remainingMinutes = processingCredits.totalMinutes - processingCredits.usedMinutes;
    const canProcess = remainingMinutes >= requiredMinutes;

    // Calculate new renewal date (each minute consumed = 1 minute earlier renewal)
    const newRenewalDate = new Date(subscription.endDate);
    if (canProcess) {
      newRenewalDate.setMinutes(newRenewalDate.getMinutes() - requiredMinutes);
    }

    return {
      canProcess,
      remainingMinutes: Math.max(0, remainingMinutes - requiredMinutes),
      newRenewalDate
    };
  }

  /**
   * Consume processing credits and update renewal date
   */
  static consumeCredits(
    subscription: UserSubscription,
    minutesConsumed: number
  ): UserSubscription {
    const processingCredits = subscription.processingCredits || {
      totalMinutes: 43200,
      usedMinutes: 0,
      renewalDate: subscription.endDate
    };

    const newUsedMinutes = processingCredits.usedMinutes + minutesConsumed;
    const newRenewalDate = new Date(subscription.endDate);
    newRenewalDate.setMinutes(newRenewalDate.getMinutes() - minutesConsumed);

    return {
      ...subscription,
      processingCredits: {
        totalMinutes: processingCredits.totalMinutes,
        usedMinutes: newUsedMinutes,
        renewalDate: newRenewalDate
      },
      endDate: newRenewalDate
    };
  }

  /**
   * Get human-readable summary of processing impact
   */
  static getProcessingSummary(minutesConsumed: number, originalEndDate: Date): {
    daysReduced: number;
    hoursReduced: number;
    minutesReduced: number;
    newEndDate: Date;
    message: string;
  } {
    const newEndDate = new Date(originalEndDate);
    newEndDate.setMinutes(newEndDate.getMinutes() - minutesConsumed);

    const totalMinutesReduced = minutesConsumed;
    const daysReduced = Math.floor(totalMinutesReduced / 1440);
    const hoursReduced = Math.floor((totalMinutesReduced % 1440) / 60);
    const minutesReduced = totalMinutesReduced % 60;

    let message = `Processing will consume `;
    if (daysReduced > 0) message += `${daysReduced} day${daysReduced > 1 ? 's' : ''} `;
    if (hoursReduced > 0) message += `${hoursReduced} hour${hoursReduced > 1 ? 's' : ''} `;
    if (minutesReduced > 0) message += `${minutesReduced} minute${minutesReduced > 1 ? 's' : ''}`;
    message += ` from your subscription period.`;

    return {
      daysReduced,
      hoursReduced,
      minutesReduced,
      newEndDate,
      message
    };
  }

  /**
   * Reset processing credits on renewal
   */
  static resetProcessingCredits(subscription: UserSubscription): UserSubscription {
    const daysInPeriod = Math.ceil(
      (subscription.endDate.getTime() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalMinutes = daysInPeriod * 1440; // Convert days to minutes

    return {
      ...subscription,
      processingCredits: {
        totalMinutes,
        usedMinutes: 0,
        renewalDate: subscription.endDate
      }
    };
  }
}
