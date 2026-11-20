[00:00] Now let's work on getting students list by a class teacher.
[00:17] let's get the full name of the function from proto file all right and
[00:39] This takes teacher ID as a request and returns students.
[01:00] all right now the first thing that we need is the teacher ID and that is going to be rec.getId
[01:27] And now let's also create the MongoDB client to access the database.
[01:52] and don't forget to defer disconnect
[02:18] And now we need to convert this string ID of the teacher to an object ID that can be used in MongoDB. So let's call primitive dot object ID from hex.
[02:40] and pass it the teacher ID.
[02:57] And now that we have the object ID we can now find the teacher using this object ID from the teacher's collection and extract that teacher's class. Because we will be filtering the students based on class.
[03:25] if they are in 9a, 9b, 10a, 10b and so on.
[03:44] and now to store the resulting value we need an instance of models.teacher and now let's create a teacher so var teacher
[04:12] and now we use the decode method and pass it the teacher by pointer and this returns an error so let's handle that
[04:38] Okay, but we need to also take in account a specific error. So that specific error is Mongo dot error no documents. That means no documents were returned by the given object ID. So that means no teacher was found.
[04:58] with the given ID.
[05:12] And let's hit save to import the Beeson package for Beeson.m. All right. And now we have the teacher and now we can access teacher.class to filter the students. So let's again call client.
[05:39] dot database and pass it school and then collection will get students and this time we are going to use dot find and to bson.m struct we are going to pass class as the key
[06:04] and teacher.class as the value. And now this is going to return us a cursor and error.
[06:28] And whenever we are dealing with client or cursor, we always need to, we always need to defer close them. All right, so now that we have a cursor,
[06:57] we know that we need to decode the values from the cursor and for that we have decode entities function readily available so we can just call that so let's call decode entities so let's call decode entities from MongoDB
[07:20] But if we look at the helper's file this is not exported. So what we are going to do is we are going to extract all this. Alright so what I'm going to do now is I'm going to extract all this into a separate function. We are going to create the database function along with this function.
[07:48] from the start. So we will not be refactoring later on. So this function will now be called get students by teacher ID from DB.
[08:13] and we don't need to call the package now and now we need the context as well as the teacher ID and now let's hit save
[08:41] and we are going to take care of the return types in the function signature later on first let's call decode entities and it needs a context then the cursor and it controls space and enter and this is going to be asterisk
[09:05] pb.student and in the next argument it's going to be models.student
[09:30] Now decodeEntities is going to return pv.student and error. A list of pv.student. Great.
[09:49] now let's handle the error and now we return students comma nil
[10:16] So the types of our return values is going to be slice of pb.student and error. And that's it. Alright, let's hit ctrl s. Now we have one more little thing to do. If there is a cursor error, we need to handle that. So let's bring up error.
[10:41] and then let's handle the cursor error all right let's save this and let's call this function in the RPC
[11:10] Pass it the respective arguments and handle the return values.
[11:31] And now let's send the response back to the client. And that's it. Let's hit save. Alright.
[11:58] And now it's time to test its functionality. So let's start the server. And let's send a request. And now let's copy an ID from the teacher's collection. And now send the request. Great!
[12:26] so we have the response from the database great and these are all from class 10a because this teacher handles class 10a she's the class teacher of class 10a great now if we use a blank id then in that case we get the error in value teacher id and
[12:54] and now what if the teacher ID is valid but there is no teacher associated with the ID in database so let's see what happens now great so we have the teacher not found error from our api because it was a valid ID it's a valid ID as per the database but there is no teacher associated with this ID and it is kind of invalid as well so it depends on
[13:22] Us, the programmers, how we want to send the response. So here we can mention invalid teacher ID as well instead of teacher not found.
[13:43] So now this RPC is complete and we are using our generic function in different functionalities in different RPCs.
[13:54] you
