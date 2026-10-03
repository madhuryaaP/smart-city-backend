const { getMessaging } = require('firebase-admin/messaging');

// ============================================================
// DEPARTMENT TOPICS
// ============================================================

const DEPARTMENT_TOPICS = {
  roads: 'department_roads',
  sanitation: 'department_sanitation',
  electrical: 'department_electrical',
  water: 'department_water',
  drainage: 'department_drainage',
  traffic: 'department_traffic',
  general: 'department_general',
};

// ============================================================
// DETERMINE DEPARTMENT FROM ISSUE CATEGORY
// ============================================================

function getDepartment(category) {
  switch (category) {
    case 'Pothole':
    case 'Damaged Road':
      return 'roads';

    case 'Garbage':
      return 'sanitation';

    case 'Street Light':
    case 'Streetlight':
      return 'electrical';

    case 'Water Leak':
      return 'water';

    case 'Drainage Issue':
      return 'drainage';

    case 'Traffic Light':
      return 'traffic';

    case 'Other':
    default:
      return 'general';
  }
}

// ============================================================
// SEND ISSUE NOTIFICATION TO DEPARTMENT
// ============================================================

async function sendDepartmentNotification(issue) {
  try {
    const messaging = getMessaging();

    const department = getDepartment(issue.category);

    const topic =
      DEPARTMENT_TOPICS[department] ||
      DEPARTMENT_TOPICS.general;

    const message = {
      topic,

      notification: {
        title: `New ${issue.category} Report`,
        body:
          `${issue.description} ` +
          `Location: ${issue.location}`,
      },

      data: {
        type: 'issue_report',
        issueId: issue._id.toString(),
        category: issue.category,
        description: issue.description,
        location: issue.location,
        severity: issue.severity || 'Medium',
        status: issue.status || 'Pending',
        department,
      },

      android: {
        priority: 'high',

        notification: {
          channelId: 'smart_city_alerts',
          sound: 'default',
          priority: 'high',
        },
      },
    };

    const messageId = await messaging.send(message);

    console.log('====================================');
    console.log('DEPARTMENT NOTIFICATION SENT');
    console.log('Issue ID:', issue._id.toString());
    console.log('Category:', issue.category);
    console.log('Department:', department);
    console.log('Topic:', topic);
    console.log('Message ID:', messageId);
    console.log('====================================');

    return {
      success: true,
      department,
      topic,
      messageId,
    };

  } catch (error) {
    console.error('====================================');
    console.error('DEPARTMENT NOTIFICATION ERROR');
    console.error(error);
    console.error('====================================');

    return {
      success: false,
      error: error.message,
      code: error.code || null,
    };
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  sendDepartmentNotification,
  getDepartment,
  DEPARTMENT_TOPICS,
};