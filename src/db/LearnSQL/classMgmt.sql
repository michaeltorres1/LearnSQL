-- classMgmt.sql - LearnSQL

-- Michael Torres
-- Web Applications and Databases for Education (WADE)

-- This file creates the functions involved with class management in the LearnSQL
--  database. This file should be run after createLearnSQLTables.sql



START TRANSACTION;

-- Make sure the current user has sufficient privilege to run this script
--  privilege required: superuser
DO
$$
BEGIN
  IF NOT EXISTS (
                  SELECT * FROM pg_catalog.pg_roles
                  WHERE rolname = CURRENT_USER AND rolsuper = TRUE
                ) 
  THEN
    RAISE EXCEPTION 'Insufficient privileges: script must be run as a user '
                      'with superuser privileges';
  END IF;
END;
$$;



-- Suppress NOTICES for this script only, this will not apply to functions
--  defined within. This hides unimportant, but possibly confusing messages.
SET LOCAL client_min_messages TO WARNING;



-- This allows users to create classes, but certain restrictions apply such as 
--  the user must be a teacher, restricting them from creating a class if the 
--  user tries to add the same class again during the same year, etc. 
CREATE OR REPLACE FUNCTION LearnSQL.createClass(
  dbUserName        VARCHAR(60),
  dbPassword        VARCHAR(64),
  teacherUserName   LearnSQL.UserData_t.UserName%Type,
  classPassword     LearnSQL.Class_t.Password%Type,
  className         LearnSQL.Class_t.ClassName%Type,
  section           LearnSQL.Class_t.Section%Type,
  times             LearnSQL.Class_t.Times%Type,
  days              LearnSQL.Class_t.Days%Type,
  startDate         LearnSQL.Class_t.StartDate%Type,
  endDate           LearnSQL.Class_t.EndDate%Type)

RETURNS VARCHAR AS
$$
DECLARE
  classID VARCHAR(63);
  -- Hashed password to be stored in LearnSQL.UserData_t.
  encryptedPassword VARCHAR(60);
  fullName VARCHAR(256); -- Used to get the full name of the teacher.
BEGIN
  classID = LOWER($5) || '_' || LearnSQL.gen_random_uuid();
  -- Any instances of the character '-' is deleted from the classID or else this
  --  will cause an error in dblink. 
  classID = REPLACE (classID, '-', '');

  SELECT LearnSQL.UserData_t.fullName
  INTO fullName
  FROM LearnSQL.UserData_t
  WHERE UserData_t.userName = $3;

  -- Check if user creating class is a teacher.
  IF NOT EXISTS (
                  SELECT 1 
                  FROM LearnSQL.UserData_t
                  WHERE UserData_t.userName = $3
                  AND UserData_t.isTeacher = TRUE 
                ) 
  THEN 
    RAISE EXCEPTION 'Class Creation Not Possible For Current User!';
  END IF;

  -- Check if class name and class section for user logged in already exists.
  IF EXISTS (
              SELECT 1 
              FROM LearnSQL.Class_t INNER JOIN LearnSQL.Attends
              ON Attends.classID = Class_t.classID
              WHERE Attends.userName = $3
              AND Class_t.className = LOWER($5)
              AND Class_t.section = LOWER($6)
            ) 
  THEN 
    RAISE EXCEPTION 'Section And Class Name Already Exists!';
  END IF;

  -- Check if the class database already exists.
  IF EXISTS (
              SELECT 1
              FROM pg_database 
              WHERE datname = classID
            )
  THEN 
    RAISE EXCEPTION 'This Class Database Already Exists!';
  END IF;

  -- Create "hashed" password using blowfish cipher.
  encryptedPassword = LearnSQL.crypt($4, LearnSQL.gen_salt('bf'));
  
  INSERT INTO LearnSQL.Class_t VALUES (LOWER(classID), LOWER($5), 
                                       LOWER($6), $7, $8, $9, $10, 
                                       encryptedPassword);

  INSERT INTO LearnSQL.Attends VALUES (LOWER(classID), $3, TRUE);

  -- Cross database link query that creates the database classID with the owner 
  --  as classdb_admin.
  PERFORM * 
  FROM LearnSQL.dblink_exec ('user=' || $1 || ' dbname=learnsql password='|| $2,
                             'CREATE DATABASE ' || LOWER(classID) || 
                             ' WITH TEMPLATE classdb_template OWNER classdb_admin');

  -- Add teacher to the Class's database.
  PERFORM *
  FROM LearnSQL.dblink ('user=' || $1 || ' dbname=' || LOWER(classID) || 
                        ' password=' || $2, 
                        'SELECT ClassDB.CreateInstructor('''||$3||''', 
                        '''||fullName||''')')
  AS throwAway(blank VARCHAR(30));-- Needed for dblink but unused.

  -- Cross database link query that gives access privileges to the database 
  --  classID.
  PERFORM *
  FROM LearnSQL.dblink ('user=' || $1 || ' dbname= ' || LOWER(classID) || 
                        ' password=' || $2, 'SELECT ClassDB.AddUserAccess()')
  AS throwAway(blank VARCHAR(30));-- Needed for dblink but unused.

  -- Returns classID of the newly created class, which is also the identifier 
  --  of the created class database.
  RETURN classID;
END;
$$ LANGUAGE plpgsql;

--Change function's owner and privileges so that only LearnSQl can use it
ALTER FUNCTION 
  LearnSQL.createClass(dbUserName        VARCHAR(60),
                       dbPassword        VARCHAR(64),
                       teacherUserName   LearnSQL.UserData_t.UserName%Type,
                       classPassword     LearnSQL.Class_t.Password%Type,
                       className         LearnSQL.Class_t.ClassName%Type,
                       section           LearnSQL.Class_t.Section%Type,
                       times             LearnSQL.Class_t.Times%Type,
                       days              LearnSQL.Class_t.Days%Type,
                       startDate         LearnSQL.Class_t.StartDate%Type,
                       endDate           LearnSQL.Class_t.EndDate%Type)
  OWNER TO LearnSQL;

REVOKE ALL ON FUNCTION 
  LearnSQL.createClass(dbUserName        VARCHAR(60),
                       dbPassword        VARCHAR(64),
                       teacherUserName   LearnSQL.UserData_t.UserName%Type,
                       classPassword     LearnSQL.Class_t.Password%Type,
                       className         LearnSQL.Class_t.ClassName%Type,
                       section           LearnSQL.Class_t.Section%Type,
                       times             LearnSQL.Class_t.Times%Type,
                       days              LearnSQL.Class_t.Days%Type,
                       startDate         LearnSQL.Class_t.StartDate%Type,
                       endDate           LearnSQL.Class_t.EndDate%Type)
  FROM PUBLIC;



-- This function returns theClassID to be used in LearnSQL.dropClass function so 
--  that the classID does not have to be supplied as a parameter.
CREATE OR REPLACE FUNCTION LearnSQL.getClassID (
  username       LearnSQL.Attends.UserName%Type,
  className      LearnSQL.Class_t.ClassName%Type,
  classSection   LearnSQL.Class_t.Section%Type,
  startDate      LearnSQL.Class_t.StartDate%Type)

RETURNS VARCHAR AS 
$$ 
DECLARE 
  theClassId LearnSQL.Class_t.classID%Type;
BEGIN 
  -- Returns the classID and assigns it to theClassID.  
  SELECT LearnSQL.Class_t.classID
  INTO theClassId
  FROM LearnSQL.Class_t INNER JOIN LearnSQL.Attends
  ON Attends.classID = Class_t.classID
  WHERE Attends.userName = $1
  AND Class_t.className = LOWER($2)
  AND Class_t.section = $3
  AND Class_t.startDate = $4;

  RETURN LOWER(theClassId); -- Return theClassID in lowercase.
END;
$$ LANGUAGE plpgsql;


--Change function's owner and privileges so that only LearnSQl can use it
ALTER FUNCTION 
  LearnSQL.getClassID (username       LearnSQL.Attends.UserName%Type,
                       className      LearnSQL.Class_t.ClassName%Type,
                       classSection   LearnSQL.Class_t.Section%Type,
                       startDate      LearnSQL.Class_t.StartDate%Type)
  OWNER TO LearnSQL;

REVOKE ALL ON FUNCTION 
  LearnSQL.getClassID (username       LearnSQL.Attends.UserName%Type,
                       className      LearnSQL.Class_t.ClassName%Type,
                       classSection   LearnSQL.Class_t.Section%Type,
                       startDate      LearnSQL.Class_t.StartDate%Type)
  FROM PUBLIC;
                       


-- This function drops the class if it exists in the LearnSQL tables and if the 
--  class database exists.
CREATE OR REPLACE FUNCTION LearnSQL.dropClass(
  dbUserName        VARCHAR(63),
  dbPassword        VARCHAR(64),
  teacherUserName   LearnSQL.UserData_t.userName%Type,
  className         LearnSQL.Class_t.ClassName%Type,
  classSection      LearnSQL.Class_t.Section%Type,
  startDate         LearnSQL.Class_t.StartDate%Type)

RETURNS VOID AS
$$
DECLARE 
  theClassID VARCHAR(63);
BEGIN 
  theClassID = learnSQL.getClassID($3, LOWER($4), $5, $6);

  -- Check if classname exists in LearnSQL tables.
  IF NOT EXISTS (
                  SELECT 1
                  FROM LearnSQL.Class_t
                  WHERE Class_t.ClassName = LOWER($4)
                )
  THEN 
    RAISE EXCEPTION 'Class Does Not Exist In Class_t Table';
  END IF;

  -- Check if the class database exists.
  IF NOT EXISTS (
                  SELECT 1 
                  FROM pg_database
                  WHERE datname = LOWER(theClassID)
                )
  THEN 
    RAISE EXCEPTION 'Class Not Found In Database %', theClassID;
  END IF;

  -- Check if class name and class section for user logged in already exists.
  IF NOT EXISTS (
                  SELECT 1 
                  FROM LearnSQL.Class_t INNER JOIN LearnSQL.Attends
                  ON Attends.classID = Class_t.classID
                  WHERE Attends.userName = $3
                  AND Class_t.className = LOWER($4)
                  AND Class_t.section = $5
                  AND Class_t.startDate = $6
                ) 
  THEN 
    RAISE EXCEPTION 'Drop Failed - User Currently Not Attending This Class!';
  END IF;

  -- Check if user that is dropping the class is a teacher.
  IF NOT EXISTS (
                  SELECT 1  
                  FROM LearnSQL.UserData_t 
                  WHERE UserData_t.userName = $3
                  AND UserData_t.isTeacher = true
                )
  THEN 
    RAISE EXCEPTION 'Only A Teacher Is Allowed To Drop A Class';
  END IF;

  -- Cross database link query to drop the class database.
  PERFORM *
  FROM LearnSQL.dblink_exec('user='|| $1 ||' dbname=learnsql  password='|| $2, 
                            'DROP DATABASE '|| theClassID);

  DELETE FROM LearnSQL.Attends
  WHERE Attends.classID = theClassID;
  
  DELETE From LearnSQL.Class_t
  WHERE Class_t.classID = theClassID;
END;
$$ LANGUAGE plpgsql;

--Change function's owner and privileges so that only LearnSQl can use it
ALTER FUNCTION 
  LearnSQL.dropClass(dbUserName        VARCHAR(63),
                     dbPassword        VARCHAR(64),
                     teacherUserName   LearnSQL.UserData_t.userName%Type,
                     className         LearnSQL.Class_t.ClassName%Type,
                     classSection      LearnSQL.Class_t.Section%Type,
                     startDate         LearnSQL.Class_t.StartDate%Type)
  OWNER TO LearnSQL;

REVOKE ALL ON FUNCTION 
  LearnSQL.dropClass(dbUserName        VARCHAR(63),
                     dbPassword        VARCHAR(64),
                     teacherUserName   LearnSQL.UserData_t.userName%Type,
                     className         LearnSQL.Class_t.ClassName%Type,
                     classSection      LearnSQL.Class_t.Section%Type,
                     startDate         LearnSQL.Class_t.StartDate%Type)
  FROM PUBLIC;

COMMIT;