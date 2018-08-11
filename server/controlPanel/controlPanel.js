const db = require('../db/ldb.js');
var uniqid = require('uniqid');

/**
 * This funciton creates a class database using a ClassDB template Database
 */
 // TODO: this should be a task of multiple queries
function createClass(req, res) {
	return handleErrors(req)
	.then(() => {
		var classid = req.body.name + '_' + uniqid(); //guarantee uniqueness
		db.none('CREATE DATABASE $1~ WITH TEMPLATE classdb_template OWNER classdb', classid)
		.then(() => {
				console.log('getting to 1');
				addClassToDB(classid, req.body.name, req.body.password);
				addInstructorToDB(req.user.username, classname);
				return res.status(200).json('Class Database Created Successfully');
		})
		.catch(error => {
			console.log('getting to 2');
			console.log(error);
			res.status(400).json({status: error});
		})
	})
}

function addInstructorToDB(username, classid) {
	db.none('INSERT INTO attends(username, classid, isteacher) VALUES(${name}, ${class}, ${isTeacher})'
	, {
		name: username,
		class: classid,
		isTeacher: true
	})
	.then(() => {
			return res.status(200).json('Instructor Added Successfully');
	})
	.catch((error) => {
			res.status(400).json({status: 'Could not add instructor to DB'});
	})
}

function addClassToDB(classname, classname, password) {
	db.none('INSERT INTO class(classid, classname, password) VALUES(${id}, ${name}, ${password}) '
	, {
		id: classid,
		name: classname,
		password: password
	})
	.then(() => {
			return res.status(200).json('Class Added Successfully');
	})
	.catch((error) => {
			res.status(400).json({status: 'Could not add Class to DB'});
	})
}

/**
 * handles errors, for now only checks the length of the password
 * Also, set to a low number for testing purposes.
 */
function handleErrors(req) {
	console.log('handleErrors');
  // TODO: fix length requirements
  return new Promise((resolve, reject) => {
  if (req.body.password.length < 1) {
      reject({
        message: 'Password must be longer than 6 characters'
      });
    } else {
      resolve();
    }
  });
}


module.exports = {
  createClass
};
