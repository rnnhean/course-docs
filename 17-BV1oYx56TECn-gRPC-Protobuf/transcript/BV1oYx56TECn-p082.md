[00:00] in order to update the password of an executive we will have to identify the exec in the database using the exec id and once the current password is verified then we can update the password in database so let's define the RPC update password now
[00:20] and provided the parameters according to our protocol buffer file.
[00:39] And now first we need to create a Mongo client to connect to the database.
[01:09] you
[01:14] And now we need to access the request ID and convert it to an object ID.
[01:44] you
[01:50] And now we use find one method to find the entry associated with this object ID.
[02:20] And as a second argument we are going to use bson.m to pass the key and value that is the field and value using which we need to find the entry, find the document in the collection.
[02:46] and in order to decode the result we need an instance of models.exec and let's also handle the error
[03:13] and now that we have the user we can verify the password so let's call verify password from utils and pass it the current password the password that has been received with the request and the password that is in the database
[03:37] and let's also handle the error
[03:54] And now if we do not encounter any error then in that case we hash the new password and save that into the database. So let's hash the password first.
[04:16] and for that we need to call the hash password function from utils and pass it the new password. Let's also handle the return values.
[04:45] And now once we have the hashed password, we need to update that into the database. And for that, we are going to use update one because it's just one entry. So let's call client dot database dot collection.
[05:12] update one, pass it the context and the second argument is going to be the filter so it's going to be bson.m with object ID.
[05:35] And for the update argument, it's going to be a little longer struct of bson.m. So let's use a variable to store that. I'm going to call this new variable update and
[06:00] And now let's declare the key and values. So first we need to declare a key dollar set because that is what we use when we update an entry. So dollar set and its value is going to be bson.m struct with password as key and that's going to take the hashed password. And this time we also need to update the password changed at field.
[06:27] because the password has been changed at this point. So it's going to be time.now.format and the format is RFC 3339.
[06:48] That's it. So we now have the update query ready. Let's pass that to update one. Here we go. And now again, we are going to discard the result and handle the error.
[07:10] and the error message is going to be failed to update the password.
[07:26] Now just like the mechanism of REST API we are now going to again generate a new token. And this step is optional if you want to implement this you can otherwise you can leave this.
[07:51] And to generate the token we call sign token from utils and pass it the required arguments.
[08:12] And now that we have the token ready, let's return the response. So this is going to be return m%pb.update password response. Password update is true.
[08:42] And the token is token. And now pass it a nil error. That's it. Let's save this and restart the server. And now let's send a request.
[09:05] And Postman arranges the field names in alphabetical order. So that's why we have ID in between current password and new password. All right. And I've already copied the ID for Alice Smith, the first entry. And password is secure.
[09:35] password one and we are going to change that to secure password triple one let's send the request user not found all right so we have a user not found and let's see what's there all right so we have a misspelled collection name let's correct that
[10:00] Save this and restart the server. And here we go, the password has been updated. And if I now use a blank ID, let's see what happens. Invalid ID, great, because it was not able to be converted to an object ID.
[10:29] Now let's use a string that can be converted to an object ID. Now we have user not found. Great. Now the user will be found but the current password is now wrong because the password has been changed to triple one.
[10:56] So let's see what happens. All right, so the password does not match the password on file. Great. And if you use 111. Well, let's use a blank password. It's still the same. Great. And now let's use a blank new password.
[11:23] and now we get an internal error and here we can actually use the error message so let's call error dot error restart the server and send the request again and here we go please enter password great and now let's switch it back to secure password one invoke and here we go
[11:52] And let's also see the entry in the database. And here we see that the password changed at field is also updated with the appropriate timestamp. Great. And let's update the password again. So if I now invoke this, this is incorrect password.
[12:20] so let's do this and again triple one and I'm going to bring this over here and now send the request and we refresh and the password is changed great
[12:49] all right so our update password function is working correctly now let's refactor this all right so the refactoring is going to start from the top and it's going to end right here control shift R and that's it
[13:16] And we are going to rename this to update password in DB. And now let's move this over to XXcrud. Hit save. And handle one error off.
[13:45] MongoDB package. All right. And what are we returning here? And let's see what we need here. We need the user ID username and user role. And we can actually extract the user ID from request as well. So that's fine. But we are going to need the username and user role from the execs crud.
[14:15] alright so alright so that's it that's all we need from this function so let's change the function signature
[14:44] and that's it and now because it's returning strings we cannot use nil for we cannot use nil keyword for nil value of string because it should be blank string
[15:08] between double quotes.
[15:28] and hit save that's it now let's come back to the execs RPC
[15:52] and correct this as well.
[16:18] And this needs a package name here.
[16:48] and that's it we're done perfect now let's again test the functionality of our RPC after refactoring and
[17:14] great we are receiving error perfectly and now let's and now let's send the correct request perfect the password is changed and it is switched back to secure password one
[17:31] Alright so now we have fully functioning update password RPC.
