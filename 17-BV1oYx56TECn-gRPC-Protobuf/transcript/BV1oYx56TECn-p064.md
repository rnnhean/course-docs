[00:00] Alright so now let's make our code more modular and that's why we now need to refactor all this. So here we are decoding the value into r struct. So what we are doing here is we are decoding the request
[00:28] to our model into our struct. So this is what I'm going to actually extract out of this function. So, well, I still have John here. So this should be blank. It actually didn't matter because we are overwriting the first name field. So that's why none of our entries in database were affected by this. All right, so now
[00:57] Let's select all this and hit Ctrl Shift R. And now we have a new function. Let me actually take this off from this function. And we are going to keep this here. So I'm going to take this off.
[01:26] And we don't need this because we are initializing I here. All right, so this is it and we are going to return and we are going to return model teacher here. So let's change the return type to models.teacher. That's it.
[01:53] And I'm going to rename this function to map PB protocol buffer teacher to model teacher. That's it. And here we are going to. And now what I'm going to do is I'm going to add the return value
[02:22] to this index of new teachers and let's also handle the error and let's fix these arguments
[02:51] All right. So yeah, we don't have any error here. So let's remove this. Okay. And all right. And we see that we have an error here. So we need actually
[03:20] the pointer to models.teacher so here we are going to use m% and here should be asterisk models.teacher all right so now this is done now here we are inserting data into document we are converting the object id that's okay
[03:46] and this. So this is again going to be extracted. So control shift R extract function. Now let's first rename this and this is going to be map model teacher.
[04:12] Alright now everything looks perfect here. So now all we need to do is extract the database functionality and that is all of this.
[04:36] so ctrl-shift-R and I'm going to rename this to add teachers to DB and that's it now instead of
[05:01] PB dot teachers, this is actually going to be a list. This is going to be a list of PB dot teacher. And this is not the request. This is teachers from request. And I should have renamed this.
[05:30] still it's fine and actually this should be completely replaced here as well and now I need to pass this rec.getTeachers all right okay and
[05:56] We have added teachers and we have a Boolean value. What is this? Why do we have this? Let's get rid of this. All right. What else?
[06:20] We have asteriskpv.teachers. Why do we have that? Let me first delete this. And this is also useless, so let's delete this.
[06:47] all right now let's save this and let's fix this as well all right and this is an error and we are handling the errors properly great
[07:14] so this should be error and and now let's handle the error and now in gRPC API as well when we encounter an error the RPC needs to communicate the error to the client so we are going to communicate that using status
[07:38] So we have three status. So we need to use the one from gRPC status. This is the one that we need to use. And on this we call error and pass it the code first, the error code. So this is going to be codes not dot okay. And it's not okay code, but it's an error. So it's going to be
[08:06] internal error so codes dot internal and now the second argument is going to be a message a message to the client so that is actually going to be propagated using error dot error great let's save this all right but this is not it we still have a problem in our add teachers function so let me run the server again go server
[08:35] so go run server and now let's send a request but let's generate a new request and here we go and now this time I'm going to include the ID field with some value when I send the request so let's see what happens invoke and here we go and now you see the problem right
[09:04] The problem is right here. Let me also bring up MongoDB Compass and let's refresh this. So here we go. This is the problem. And it's a simple fix to avoid this. We need the IDs to be generated automatically by MongoDB. We don't need to create our own ID. Now we can also fix this from inside the database.
[09:31] But we are working on an API and we need to learn to code. So we are going to fix this using code and it's a very simple fix. We are going to loop over the request.
[09:51] and now we are going to check for teacher ID so teacher dot ID and we are going to now check if teacher ID is not equal to a blank string and now if it is not equal to blank string then we are going to return an error so
[10:18] a nil value and an error so status not error and this is going to be codes not okay but invalid argument and an error message so request is in incorrect
[10:43] Format. So request is in incorrect format and non-empty ID fields should not be allowed. All right, now let's save this.
[11:12] let's restart the server and let's try and send this request again or maybe generate a new request and invoke and here we go request is in incorrect format non-MTID fields are not allowed perfect all right so now that we have a separate function for the database operations
[11:35] We will need a teacher's crud file in repository's MongoDB folder.
[11:53] all right let's copy this over and let's hit save and we still have two errors
[12:22] all right we don't need this now save great all right and here we just need to call MongoDB dot add teachers to dv that's it and then hit save and great all right so now we are finished with refactoring and our code is now modular
[12:49] And now this modularity is going to come into play very very soon and this is going to be highly beneficial for us as we move forward in this project.
[13:00] you
