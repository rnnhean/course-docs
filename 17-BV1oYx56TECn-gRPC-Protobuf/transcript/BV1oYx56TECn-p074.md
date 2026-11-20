[00:00] Okay, so let's start creating the CRUD RPCs for students as well as execs. And before we do so, we first need the model for both of them. So let's create exec.go and student.go in models folder.
[00:25] and for student we are going to name this student and I'll just copy over the teacher model here and remove the subject field that's it
[00:52] all right and let me copy over this to exec and rename this to exec and now this is going to be username and now let's
[01:22] Copy this multiple times. Alright, then we have password. Next we have a role.
[01:43] and next we have password changed at
[01:57] And next we have user created that.
[02:14] and next we have password reset token and next is password
[02:44] token expires. And let me correct this password reset token in Beeson tag. Alright, next we have
[03:13] inactive status all right and now the inactive status needs to be a boolean value that's it save that's it all right now i told you about the omit empty tag
[03:42] when we were learning go when we were learning structs in the earlier sections of go and we have discussed omit-empty later as well so what omit-empty does is is that if the value of this field is its zero type not zero but zero type so that means if it is int then it may be zero if it's string then it may be blank
[04:08] So if this field has a zero type value, a zero value for its type, then in that case we are going to omit this field and it will not show up and it will not be passed on to the caller. It won't be showing up at all. This will be completely blank in the instance of this struct. Alright. So why am I bringing this up again?
[04:35] Well that's because inactive status is going to be false by default and it's going to become true if a user becomes inactive if a user is inactivated deactivated by the admin or the manager but other than that when the user is first created or when the user is active and the user is working in the organization in the school then this value is going to be false and when we are
[05:02] getting the values when the administrator calls a get method and the administrator wants all the details of the exec that means we need to send all the fields that means we need to send value for all the fields for this exec and maybe some fields are blank and in that case those fields can be left but the problem is when we have a value which is false for inactive status
[05:30] Then that is also going to be left. It's going to be discarded because we are using omit-empty. Alright, so that's why we should remove omit-empty in this case because we need this field every time whether it's false or true. And now you may ask why would it be discarded if it has value associated with it, which is false. Well, the zero value for Boolean type is false.
[05:58] The zero type for integer is zero zero type for string zero value for string type is blank string and Zero value for Boolean is false Because a Boolean can only have true or false. It does not have any blank values So the zero value for Boolean was decided to be false and if we have false here and if you are using omit-empty
[06:25] that means that we are going to omit the false value. That means we are going to consider that as non value for this field. And that means that we are going to omit this field because we will consider this as empty as zero value. So I'm going to remove omit empty from the inactive status struct tags. Alright, so this is an important concept.
[06:53] Always remember that when you are making models, when you are using a Boolean value in a model in your project. Alright, so now let's close these models. And now let's create the handlers for students and execs. So let's take up execs first. execs.go in handlers folder.
[07:19] And we also need the crud file, the database crud file for xx and we need to create that in the MongoDB folder.
[07:39] Alright, so let's first create the function for adding new entry.
[07:59] Alright and we need this import statement. Others are going to come automatically but this one doesn't come automatically because this is a named import. Alright so let's rename the function.
[08:26] and now let's hit Ctrl F
[08:47] Actually, we need to rename this. I forgot to rename others, which I should have.
[09:15] This should have been renamed but I'm going to have to manually rename the instances of this now.
[09:45] you
[10:01] you
[10:31] all right now in our helpers we commented these out so
[10:43] There's now uncommon these.
[11:02] and let's correct the errors that's it save this
[11:24] And now let's correct the function names in execs.crud file as well. And hit Ctrl S.
[11:53] Alright, so this is wrong. Let's correct this here as well. Save.
[12:14] Alright, so we have two warnings for a student because because these are not implemented yet, but we are going to implement them. Alright, so now our add execs to DB function is done. Let's also define the RPC here. So we just need to copy add teachers and
[12:42] modify this to align with xx.
[13:11] And I need to import BB here.
[13:41] you
[14:10] you
[14:40] Alright, let's hit save and we're done. Great. Alright and let's also do the same for students. So in MongoDB, first create the student squared file.
[15:05] Alright and now we need to replace all the instances of exec with student. And let's rename this over here.
[15:33] All right and this is going to be student
[16:03] you
[16:23] you
[16:52] all right so now let's also create the add students RPC
[17:11] in the handlers folder.
[17:40] you
[18:01] you
[18:31] Now let's get back to the execs crud function, add execs to db. Now in this function we know that we need to encrypt the password.
[19:01] And we also need to add a value for the inactive status field. Alright, so let's first deal with the password. So we need to hash the password, right? And now we realize that hashing the password will remain the same function that it was in our REST API. So let's copy that function over to our gRPC API. So in the utils folder, I'm going to introduce a new file password.go.
[19:27] and apart from hashing the password verifying the password will also have the same implementation it doesn't change because gRPC doesn't change how you verify the password so that's also going to remain the same and that's why we are going to copy both of the functions from our REST API over to our gRPC API so that's
[19:51] copy them here all right so now let's save this and now we have hash password and verify password functions and we can use the hash password in our add execs to db but while we are at it
[20:17] We know that there are some other utility functions that we can use which will not differ in functionality whether it's gRPC API or REST API. So let's consider them as well. So next we will also be using JWT. So let's bring that here as well in our utils folder. So this is going to be JWT.go and paste it. We had already imported these packages in the beginning of our project.
[20:45] So that's why we are not getting any errors when we are implementing these in our functions. All right. All right. So now let me close this and this as well. And now let's come back to our add execs to db function. All right. So now this is the point where we are creating the instance of models dot exec by using the incoming request. So here we are going to create a hashed password.
[21:14] and that is going to call utils.hash password and to this we pass the password which is newexxi.password and now let's see well hash password returns to
[21:41] values so let's handle them both. Okay and now that we have the hashed password we are going to overwrite the existing password so new execs i dot password will now be equal to the hashed password.
[22:11] Alright and now we also need the user created at in our SQL our database was generating this value but now this time we are using MongoDB and we are going to be sending the time value when the user is created from our code. So the current time is equal to time dot now.
[22:40] and let's format that so this is going to be format and the format is going to be time dot rfc 3339 and now again access new xx i dot user created at and now this time we are going to overwrite user created at
[23:06] with the current time and let's also set the inactive status to false that's it alright and now let's test our new RPCs but first I'm going to need the execs data as well that we need to add to our database
[23:32] all right so let's copy this and we are going to paste this into postman and let's first restart the server and now
[23:59] in postman we are going to add execs so here alright and let's delete all these values and paste our values here actually first let's try sending one entry and then we will try sending multiple entries so I'm still going to paste this but delete the rest
[24:26] All right, beautify this. Great. Okay, and let me also bring up MongoDB Compass. And now let's send the request. Great, our request went through and the password is hashed. And we have the salt before the dot and then the password after the dot. Great, just like we had in REST API.
[24:55] and we have user created at as well as the inactive status and now let's refresh this and here we have execs with the value perfect now you see that the other columns the other fields are not showing up here because they were not sent to MongoDB
[25:24] And that is because we used omit-empty. So let me come back to the struct. And here. So we see that we don't have password changed at, password reset token and password token expires in this document. And that is because the Beason tag includes omit-empty for all these.
[25:52] And if we used omir-empty for inactive status, well, it would not have been posted as false value in the document. Alright, and now let's also send multiple requests. So I'm going to hit Ctrl Z and let's delete the first entry of Alice. And let's format this.
[26:20] and send the request. Great. Here we go. We have all the requests entered into the database. Great. So now we have all the 10 entries for execs in our execs collection.
[26:43] and now similarly let's add new entries for students as well and again I'm going to first start with just one entry and then move on with multiple entries so add students
[27:10] And format this and send. Great. And now we have the students collection with one entry. Now let's send all the entries together.
[27:37] And one thing that I need to do is I need to stop this. So connected to MongoDB is appearing because we were testing createMongoClient function earlier, but now we don't need to. So it's actually just this one line. Save it and restart the server. All right.
[28:06] Always try and avoid unnecessary debug print statements on the terminal. And always remove these debug print statements from your code once they have served their purpose. Either remove them or comment them out. Alright, so now let's send multiple students. Let's format them. Alright, send. And here we go. And refresh.
[28:36] And now we have 335 students. Great. So we have tested the functionality of our add execs and add students RPC and our add teachers RPC was already functioning properly. Great. So now let's move on to getting these values from the database to the client.
[28:58] you
